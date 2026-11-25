export type Spec = {
  title: string;
  colors: { name: string; hex: string }[];
  type: { name: string; size: number }[];
  spacing: number[];
  components: string[];
};

export const products: Spec[] = [
  {
    title: 'Harbor design system',
    colors: [{ name: 'Ink', hex: '#142737' }, { name: 'Tide', hex: '#146D65' }, { name: 'Foam', hex: '#DAF0E8' }, { name: 'Sand', hex: '#F5E4C8' }],
    type: [{ name: 'Display', size: 48 }, { name: 'Heading', size: 32 }, { name: 'Body', size: 16 }, { name: 'Caption', size: 12 }],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64],
    components: [
      'Button — use Tide for the primary action. Keep a 44 px minimum target and show an explicit focus ring.',
      'Text field — place the label above the input. Keep help and validation immediately below the field.',
      'Navigation — keep the current destination visible and collapse secondary links on narrow screens.',
      'Dialog — focus the first meaningful control on open and restore focus to the trigger on dismissal.',
      'Status badge — pair color with a readable status label.',
      'Toast — announce ordinary updates politely and leave actionable errors visible.',
      'Table — right-align numeric cells and place units in the column header.',
      'Empty state — describe the missing content and provide one next action.',
    ],
  },
  {
    title: 'Product requirements template',
    colors: [{ name: 'Plum', hex: '#573568' }, { name: 'Paper', hex: '#F5EBFA' }],
    type: [{ name: 'Section', size: 28 }, { name: 'Notes', size: 15 }],
    spacing: [8, 16, 24, 40],
    components: ['Problem — name the audience and the current obstacle.', 'Outcome — pair a target metric with a measurement window.', 'Scope — list the first release and follow-up work.', 'Acceptance — describe observable behavior and edge cases.'],
  },
  {
    title: 'Form component specification',
    colors: [{ name: 'Focus', hex: '#225CCE' }, { name: 'Error', hex: '#A92236' }],
    type: [{ name: 'Label', size: 16 }, { name: 'Help', size: 13 }],
    spacing: [4, 8, 16, 24],
    components: ['Text input — associate native labels with fields.', 'Error summary — link each message to its field.', 'Submit — keep feedback adjacent to the action.'],
  },
  {
    title: 'Motion specification',
    colors: [{ name: 'Signal', hex: '#BD551F' }, { name: 'Canvas', hex: '#FFF1E1' }],
    type: [{ name: 'Timeline', size: 26 }, { name: 'Annotation', size: 14 }],
    spacing: [8, 12, 20, 32],
    components: ['Hover — transition color over 120 ms.', 'Disclosure — reveal content over 200 ms using ease-out.', 'Reduced motion — remove travel and preserve the final state.'],
  },
];