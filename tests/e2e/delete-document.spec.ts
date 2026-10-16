// End-to-end test of deleting an unsigned consent form from the dashboard: a wrong password is refused, the right one deletes it and its signing link stops working.

import { expect, test } from "@playwright/test";
import { createClientWithLink, createStaffUser, signIn } from "./helpers";

test("staff delete an unsigned form after re-entering their password", async ({ page }) => {
  // A separate staff login, so the owner's sign-in rate limit isn't used up by this test.
  const staff = await createStaffUser();
  await signIn(page, staff);
  const { signingUrl, clientUrl } = await createClientWithLink(page);
  page.on("dialog", (dialog) => dialog.accept());

  await page.getByRole("link", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete unsigned document" })).toBeVisible();

  await page.getByLabel("Your password").fill("not-my-password");
  await page.getByRole("button", { name: "Delete document" }).click();
  await expect(page.getByText("That password is not correct.")).toBeVisible();

  await page.getByLabel("Your password").fill(staff.password);
  await page.getByRole("button", { name: "Delete document" }).click();
  await expect(page).toHaveURL(new RegExp(`${clientUrl.split("localhost:3200")[1]}\\?deleted=1$`));
  await expect(page.getByText("The unsigned document was deleted.")).toBeVisible();
  await expect(page.getByText("None yet.")).toBeVisible();

  await page.goto(signingUrl);
  await expect(page.getByText("This form can no longer be signed. Please contact the studio.")).toBeVisible();
});
