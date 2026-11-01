import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
await p.goto('http://localhost:4181/#progress');
await p.getByTestId('profile-setup').waitFor();
await p.getByLabel('Starting weight').fill('145'); await p.getByLabel('Goal weight').fill('180');
await p.getByRole('button', { name: 'Save' }).click();
console.log('after setup:', await p.getByTestId('current-weight').innerText());
await b.close();
