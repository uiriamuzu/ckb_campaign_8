'use client';

import { products, type Spec } from '../lib/catalogue';
import { channelFundingGuidance } from '../lib/channel-funding';
import { useEffect, useRef, useState } from 'react';
import { scriptToAddress, type Channel, type FiberBrowserNode, type GetPaymentResult } from '@fiber-pay/sdk/browser';
import { decryptResult, encryptResult, toHex } from '../lib/crypto';
import { bottle, channelFundingCkb, connectAndOpenChannel, readChannel, ready, startRole } from '../lib/fiber';
import { createOffer, parseOffer, type EncryptedOffer } from '../lib/offer';
import { payForOffer, validateOffer } from '../lib/payment';
import { createBrowserNodeSession } from '../lib/node-session';
import { encryptedSessionKey, encryptedBuyerProfile, encryptedSellerProfile, savedNodeIdentifier, readEncryptedProgress, type EncryptedLessonProgress } from '../lib/progress';

type Item = EncryptedOffer & {
  preview: Pick<Spec, 'title' | 'colors' | 'type'>;
  status: 'locked' | 'paying' | 'unlocked' | 'failed';
  payment?: GetPaymentResult;
  spec?: Spec;
};

type Role = 'buyer' | 'seller';
const ckb = (value: string) => `${Number(BigInt(value)) / 100_000_000}`;

export default function Page() {
  const nodes = useRef<Partial<Record<Role, FiberBrowserNode>>>({});
  const sessions = useRef<Partial<Record<Role, ReturnType<typeof createBrowserNodeSession>>>>({});
  const progress = useRef<EncryptedLessonProgress | null>(null);
  const locked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Partial<Record<Role, string>>>({});
  const [connected, setConnected] = useState<Partial<Record<Role, boolean>>>({});
  const [channels, setChannels] = useState<Partial<Record<Role, Channel>>>({});

  const [generated, setGenerated] = useState('');
  const [received, setReceived] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readEncryptedProgress(sessionStorage, localStorage);
    progress.current = saved;
    if (saved) { setGenerated(saved.generatedOffer); setReceived(saved.buyerOfferText);  }
    setLoaded(true);
    const owned = sessions.current;
    const stop = () => { for (const session of Object.values(owned)) void session.stop().catch(() => {}); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); stop(); nodes.current = {}; sessions.current = {}; };
  }, []);

  function save(update: Partial<EncryptedLessonProgress>) {
    const buyerId = savedNodeIdentifier(localStorage, encryptedBuyerProfile);
    const sellerId = savedNodeIdentifier(localStorage, encryptedSellerProfile);
    if (!buyerId || !sellerId) throw new Error('Start both saved nodes before continuing.');
    const next = { version: 1 as const, buyerId, sellerId, generatedOffer: '', buyerOfferText: '', attemptedPaymentHash: '', triedWithoutKey: false, ...progress.current, ...update };
    sessionStorage.setItem(encryptedSessionKey, JSON.stringify(next));
    progress.current = next;
  }

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Action failed. Check status before retrying a transfer.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function refresh(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    const channel = await readChannel(node);
    const { peers } = await node.listPeers();
    setConnected((previous) => ({ ...previous, [role]: peers.some(peer => peer.pubkey.replace(/^0x/i, '').toLowerCase() === bottle.pubkey.slice(2)) }));
    setChannels((previous) => ({ ...previous, [role]: channel }));
  }

  async function start(role: Role) {
    if (nodes.current[role]) return;
    const session = sessions.current[role] ??= createBrowserNodeSession();
    let started: FiberBrowserNode | undefined;
    await session.start(role === 'buyer' ? encryptedBuyerProfile : encryptedSellerProfile, async (track) => {
      started = await startRole(role, track);
    });
    if (!started) return;
    nodes.current[role] = started;
    const info = await started.nodeInfo();
    setAddresses((previous) => ({ ...previous, [role]: scriptToAddress(info.default_funding_lock_script, 'testnet') }));
    if (await readChannel(started)) await started.connectPeer(bottle);
    await refresh(role);
  }

  async function open(role: Role) {
    const node = nodes.current[role];
    if (!node) return;
    const channel = await connectAndOpenChannel(node);
    setChannels((previous) => ({ ...previous, [role]: channel }));
    await refresh(role);
    setStatus(channel && ready(channel) ? 'Channel ready.' : 'Opening submitted. Check channel status after confirmation.');
  }

  async function moveLiquidity() {
    const node = nodes.current.seller;
    if (!node) return;
    const id = savedNodeIdentifier(localStorage, encryptedSellerProfile);
    const storageKey = `fiber-docs:encrypted-inbound:${id}`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing === 'submitting') throw new Error('Transfer outcome unknown. Review payment history before sending again.');
    let result: GetPaymentResult;
    if (existing) result = await node.getPayment({ payment_hash: existing as `0x${string}` });
    else {
      sessionStorage.setItem(storageKey, 'submitting');
      result = await node.sendPayment({ target_pubkey: bottle.pubkey, amount: '0x1dcd65000', keysend: true });
      sessionStorage.setItem(storageKey, result.payment_hash);
    }
    if (!['Success', 'Failed'].includes(result.status)) result = await node.waitForPayment(result.payment_hash, { timeout: 60_000, interval: 1_000 });
    if (result.status === 'Failed') sessionStorage.removeItem(storageKey);
    setStatus(`Liquidity transfer: ${result.status}`);
    await refresh('seller');
  }

  async function makeOffer() {
    if (!nodes.current.seller || !channels.seller || !routeReady || generated) return;
    const encrypted = await Promise.all(products.map(product => encryptResult(JSON.stringify(product))));
    const seller = nodes.current.seller;
    const channel = channels.seller;
    const invoices = [];
    for (const payload of encrypted) invoices.push(await createOffer(seller, channel, payload));
    const value = JSON.stringify(invoices.map((invoice, index) => {
      const { title, colors, type } = products[index];
      return { ...JSON.parse(invoice), preview: { title, colors, type } };
    }), null, 2);
    save({ generatedOffer: value }); setGenerated(value); setStatus('Invoice created.');
  }

  const paymentStorageKey = (item: EncryptedOffer) =>
    'shop:payment:' + savedNodeIdentifier(localStorage, encryptedBuyerProfile) + ':' + item.paymentHash;

  async function validate() {
    const buyer = nodes.current.buyer;
    if (!buyer) return;
    const entries = JSON.parse(received);
    if (!Array.isArray(entries) || !entries.length) throw new Error('Paste a catalogue offer.');
    const parsed: Item[] = [];
    for (const entry of entries) {
      const offer = parseOffer(JSON.stringify(entry));
      const preview = entry.preview;
      if (typeof preview?.title !== 'string' ||
          !Array.isArray(preview.colors) || !Array.isArray(preview.type) ||
          !preview.colors.every((c: Spec['colors'][number]) => typeof c?.name === 'string' && /^#[0-9a-f]{6}$/i.test(c.hex)) ||
          !preview.type.every((t: Spec['type'][number]) => typeof t?.name === 'string' && Number.isInteger(t.size) && t.size >= 8 && t.size <= 96)) {
        throw new Error('Invalid product preview.');
      }
      if (parsed.some(item => item.iv === offer.iv || item.paymentHash === offer.paymentHash)) throw new Error('Duplicate IV or payment hash.');
      await validateOffer(buyer, offer);
      parsed.push({ ...offer, preview, status: sessionStorage.getItem(paymentStorageKey(offer)) ? 'paying' : 'locked' });
    }
    save({ buyerOfferText: received });
    setItems(parsed);
    setStatus('Catalogue validated.');
  }

  function updateItem(item: Item, update: Partial<Item>) {
    setItems(previous => previous.map(current => current.paymentHash === item.paymentHash ? { ...current, ...update } : current));
  }

  async function testLock(item: Item) {
    try { await decryptResult(item, toHex(crypto.getRandomValues(new Uint8Array(32)))); }
    catch { setStatus('Decryption rejected: key unavailable.'); }
  }

  async function pay(item: Item, check = false) {
    const buyer = nodes.current.buyer;
    if (!buyer) return;
    const storageKey = paymentStorageKey(item);
    const result = check
      ? await buyer.getPayment({ payment_hash: item.paymentHash })
      : await payForOffer(buyer, item, sessionStorage.getItem(storageKey) ? item.paymentHash : '', hash => {
          if (hash) sessionStorage.setItem(storageKey, 'yes');
          else sessionStorage.removeItem(storageKey);
          updateItem(item, { status: hash ? 'paying' : 'locked' });
        }, item.payment?.status === 'Failed');
    updateItem(item, { payment: result, status: result.status === 'Failed' ? 'failed' : 'paying' });
    setStatus(item.preview.title + ' — payment ' + result.status);
    if (result.status === 'Failed') setError(result.failed_error ?? 'Payment failed.');
    if (result.status === 'Success') {
      if (!result.payment_preimage) throw new Error('Payment succeeded but the preimage is unavailable.');
      const spec: Spec = JSON.parse(await decryptResult(item, result.payment_preimage));
      updateItem(item, { spec, status: 'unlocked' });
    }
    await Promise.all([refresh('buyer'), refresh('seller')]);
  }
  const routeReady = Boolean(connected.buyer && connected.seller && channels.buyer && ready(channels.buyer) && BigInt(channels.buyer.local_balance) >= 100_000_000n && channels.seller && ready(channels.seller) && BigInt(channels.seller.remote_balance) >= 100_000_000n);

  return <main>
    <p className="eyebrow">Fiber Testnet</p><h1>Design spec shop</h1>
    {status && <p className="status" role="status">{status}</p>}{error && <p role="alert">{error}</p>}
    <div className="grid">{(['buyer', 'seller'] as const).map((role) => <section className="card" key={role}>
      <h2>{role === 'buyer' ? 'Buyer A' : 'Seller C'}</h2>
      {!addresses[role] && <button disabled={!loaded || busy} onClick={() => void run(() => start(role))}>Start node</button>}
      {addresses[role] && <><code>{addresses[role]}</code><a href="https://faucet.nervos.org" target="_blank" rel="noreferrer">Get Testnet CKB ↗</a>
        {!channels[role] && <p>{channelFundingGuidance}</p>}
        <button disabled={busy} onClick={() => void run(() => open(role))}>{channels[role] ? 'Reconnect / check channel' : `Open ${channelFundingCkb} CKB channel`}</button>
        <button disabled={busy} onClick={() => void run(() => refresh(role))}>Refresh channel status</button>
      </>}
      {channels[role] && <><code>{channels[role].state.state_name}</code><p>{role}: {ckb(channels[role].local_balance)} CKB · Bottle: {ckb(channels[role].remote_balance)} CKB</p></>}
    </section>)}</div>
    <section className="card"><h2>Liquidity</h2><button disabled={busy || !channels.seller || !ready(channels.seller) || BigInt(channels.seller.local_balance) < 500_000_000n} onClick={() => void run(moveLiquidity)}>Send / check 5 CKB transfer</button></section>
    <div className="grid exchange"><section className="card"><h2>Seller</h2>
      <ul>{products.map(product => <li key={product.title}>{product.title} · 1 CKB</li>)}</ul>
      <button disabled={busy || !routeReady || Boolean(generated)} onClick={() => void run(makeOffer)}>Encrypt & create four invoices</button>
      <textarea aria-label="Generated offer" readOnly value={generated} />
      <button disabled={!generated || busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(generated); setStatus('Offer copied.'); })}>Copy offer</button>
    </section><section className="card"><h2>Buyer</h2>
      <textarea aria-label="Received offer" disabled={busy || items.length > 0} value={received} onChange={e => setReceived(e.target.value)} />
      <button disabled={busy || !received || !addresses.buyer || items.length > 0} onClick={() => void run(validate)}>Validate catalogue</button>
    </section></div>
    <div className="grid">{items.map((item, index) => <article className="card" key={item.paymentHash}>
      <h2>{item.preview.title}</h2>
      <p>{item.status} · 1 CKB</p>
      {!item.spec && <section aria-label="Free visual preview">
        <h3>Free preview</h3>
        <Swatches colors={item.preview.colors} />
        <TypeScale samples={item.preview.type} />
      </section>}
      {index === 0 && item.status === 'locked' && <button disabled={busy} onClick={() => void run(() => testLock(item))}>Decrypt without key</button>}
      {(item.status === 'locked' || item.status === 'failed') && <button disabled={busy || !routeReady} onClick={() => void run(() => pay(item))}>{item.status === 'failed' ? 'Retry payment' : 'Pay 1 CKB'}</button>}
      {item.status === 'paying' && <button disabled={busy} onClick={() => void run(() => pay(item, true))}>Check payment status</button>}
      {item.payment?.status === 'Success' && <section><h3>Receipt</h3>
        <p>Amount 1 CKB · Fee {ckb(item.payment.fee)} CKB · Total {ckb(String(100_000_000n + BigInt(item.payment.fee)))} CKB</p>
        <code>{item.payment.payment_hash}</code>
      </section>}
      {item.spec && <section className="spec" aria-label="Unlocked specification">
        <h3>Colour tokens</h3>
        <Swatches colors={item.spec.colors} />
        <h3>Type scale</h3>
        <TypeScale samples={item.spec.type} />
        <h3>Spacing</h3>
        <ul className="spacing">{item.spec.spacing.map(value => <li key={value}><span style={{ width: value }} />{value} px</li>)}</ul>
        <h3>Components</h3>
        <ul>{item.spec.components.map(component => <li key={component}>{component}</li>)}</ul>
      </section>}
    </article>)}</div>
  </main>;
}

function Swatches({ colors }: { colors: Spec['colors'] }) {
  return <ul className="swatches">{colors.map(({ name, hex }) => <li key={name}>
    <span style={{ backgroundColor: hex }} />
    {name} <code>{hex}</code>
  </li>)}</ul>;
}

function TypeScale({ samples }: { samples: Spec['type'] }) {
  return <ul className="type-scale">{samples.map(({ name, size }) => <li key={name}>
    <span style={{ fontSize: size }}>Aa</span><small>{name} · {size} px</small>
  </li>)}</ul>;
}