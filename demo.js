const hints = [
  {
    title: 'Look at the last pass.',
    text: 'What value does i have on the final iteration? Which item would items[i] try to read?',
    next: 'Give me a hint',
  },
  {
    title: 'Compare the two ranges.',
    text: 'Write down the values produced by range(4). Then write down the valid indices for a list with three items.',
    next: 'Explain the concept',
  },
  {
    title: 'An index starts at zero.',
    text: 'A two-item list has indices 0 and 1. The index 2 is already past the end. Apply that same reasoning to the three-item list in the editor.',
    next: 'Restart demo',
  },
];

const advance = document.querySelector('#advance');
const title = document.querySelector('#hint-title');
const response = document.querySelector('#hint-text');
const steps = document.querySelectorAll('.steps li');
let level = -1;

advance.addEventListener('click', () => {
  level = level === hints.length - 1 ? -1 : level + 1;
  const hint = hints[level];
  title.textContent = hint?.title ?? 'Need a nudge?';
  response.textContent = hint?.text ?? 'Start with a question about the loop.';
  advance.textContent = hint?.next ?? 'I’m stuck';

  steps.forEach((step, index) => {
    if (index === level) {
      step.setAttribute('aria-current', 'step');
    } else {
      step.removeAttribute('aria-current');
    }
  });
});
