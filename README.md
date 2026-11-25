# ckb_campaign_8

The Design Spec Shop sells four reusable front-end standards on CKB Testnet. Pick a design system, PRD template, form component specification, or motion specification for 1 CKB each.

The tutorial quiz raises a quality gap. Payment releases a key that fits the ciphertext, while the free swatches and type samples let buyers judge the design before spending. The starter used a fixed-height text result. The shop lays out color tokens, real-size type, spacing, and component guidance in the page.

Each product is encrypted independently with AES-256-GCM using a random 256-bit key and 96-bit IV. Each Testnet invoice uses its product key as the payment preimage and SHA-256 as its payment hash algorithm. The shop keeps the starter's node startup, faucet, channel opening, and 1 CKB price.

## Run locally

Use Node.js 22.18 or newer and npm.

```sh
cd encrypted-data-payment
npm install
npm run dev
```

Open [localhost:3001](http://localhost:3001). The browser runtime requires cross-origin isolation, Web Locks, and SharedArrayBuffer.

1. Start Buyer A and Seller C. Fund each displayed address through the [Nervos Testnet faucet](https://faucet.nervos.org). Each needs 500 Testnet CKB plus the on-chain funding transaction fee.
2. Open both channels and refresh until both show `CHANNEL_READY`. Check seller-side Bottle liquidity. Use the starter's 5 CKB transfer if needed.
3. Create four invoices, copy the offer JSON, paste it into the buyer field, and validate the catalogue.
4. Review the swatches and type samples. Choose **Decrypt without key** on the first card to see rejection.
5. Click **Pay 1 CKB** on one card. Its receipt shows the fee and payment hash, and its spec renders in place. Try a second card and inspect the two remaining locked cards.
6. After a reload in the same tab, restart the saved nodes, validate the restored catalogue, and use **Check payment status** on previously attempted items.

## Measured starter baseline

| Event | Time |
| --- | ---: |
| Channel A–B opening starts | 1.46 s |
| Channel A–B CHANNEL_READY | 59.88 s |
| Channel C–B opening starts | 2.11 s |
| Both channels ready | 1:11.20 |
| Payment pending | 1.76 s |
| Payment Success, B–C moved | 3.86 s |
| A–B bar caught up | 4.68 s (0.82 s gap) |

The reported run paid 1 CKB plus 0.001 CKB routing fee, for 1.001 CKB per invoice. At the same fee, two separate purchases total 2.002 CKB. Actual routing fees appear in each receipt. Channel funding and its on-chain transaction fee are separate.

## Scope

The example specs ship as public demo fixtures in the application source. The paywall demonstration runs on their encrypted offers. The shop has no account system, mainnet support, or quality guarantee. Previews are seller-supplied public data.

See the [Fiber tutorial](https://www.fiber.world/docs/build/encrypted-data-payment).