import { expect, test } from '@playwright/test';

const SECRET = process.env.ROOM_CREATE_SECRET || 'e2e-secret';

async function confirmDialog(page, { fill, confirmName = 'OK' } = {}) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (fill != null) {
    await dialog.locator('input').first().fill(fill);
  }
  await dialog.getByRole('button', { name: confirmName }).click();
}

test.describe('live room UI smoke', () => {
  test('create party → viewer join → leave to hub', async ({ browser }) => {
    const host = await browser.newPage();
    await host.goto('/');

    await expect(host.getByRole('button', { name: 'Создать партию' })).toBeVisible();

    await host.getByRole('button', { name: 'Создать партию' }).click();
    await confirmDialog(host, { fill: SECRET, confirmName: 'Продолжить' });

    // Success alert with room code
    const success = host.getByRole('dialog');
    await expect(success).toContainText(/Комната создана\. Код:/);
    const text = await success.locator('p').innerText();
    const match = text.match(/Код:\s*([A-Z0-9]+)/i);
    expect(match).toBeTruthy();
    const roomId = match[1].toUpperCase();
    await success.getByRole('button', { name: 'OK' }).click();

    // Host lands on setup
    await expect(host.getByRole('main').getByText(roomId)).toBeVisible();

    const guest = await browser.newPage();
    await guest.goto('/');
    await guest.getByRole('button', { name: 'Войти по коду' }).click();
    await guest.getByPlaceholder('КОД').fill(roomId);
    await expect(guest.getByRole('button', { name: 'Войти зрителем' })).toBeEnabled({ timeout: 10_000 });
    await guest.getByRole('button', { name: 'Войти зрителем' }).click();

    await expect(guest.getByText('Ожидайте, пока хост')).toBeVisible();
    await expect(guest.getByRole('main').getByText(roomId)).toBeVisible();

    await guest.getByRole('button', { name: 'Выйти' }).click();
    await expect(guest.getByRole('button', { name: 'Создать партию' })).toBeVisible();

    await guest.close();
    await host.close();
  });
});
