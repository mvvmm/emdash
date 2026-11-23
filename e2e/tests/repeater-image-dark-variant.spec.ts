import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures";

const LIGHT_URL = "https://media.example.test/logo-light.png";
const DARK_URL = "https://media.example.test/logo-dark.png";
const CONTENT_EDIT_URL_PATTERN = /\/content\/[^/]+\/[^/]+$/;

const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

const csrfHeaders = (token: string) => ({
	Authorization: `Bearer ${token}`,
	"X-EmDash-Request": "1",
	"Content-Type": "application/json",
});

async function pickFromUrl(page: Page, dialogName: string, url: string) {
	const picker = page.getByRole("dialog", { name: dialogName });
	await picker.getByRole("tab", { name: "From URL" }).click();
	await picker.getByLabel("Image URL").fill(url);
	await picker.getByRole("button", { name: "Use URL" }).click();
	await picker.getByRole("button", { name: "Select", exact: true }).click();
	await expect(picker).toBeHidden();
}

test.describe("Repeater image dark variant", () => {
	test.beforeEach(async ({ admin, page }) => {
		await page.route("https://media.example.test/**", (route) =>
			route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG }),
		);
		await admin.devBypassAuth();
	});

	test("stores the variant in the row and renders both images", async ({
		admin,
		page,
		serverInfo,
	}) => {
		test.setTimeout(90_000);
		const headers = csrfHeaders(serverInfo.token);
		const collection = `logo_pages_${crypto.randomUUID().slice(0, 8)}`;
		const create = async (url: string, body: unknown) => {
			const response = await page.request.post(url, { headers, data: body });
			expect(response.ok(), `${url}: ${await response.text()}`).toBe(true);
			return response.json();
		};

		await create("/_emdash/api/schema/collections", {
			slug: collection,
			label: "Logo pages",
			labelSingular: "Logo page",
		});
		await create(`/_emdash/api/schema/collections/${collection}/fields`, {
			slug: "title",
			label: "Title",
			type: "string",
			required: true,
		});
		const field = await create(`/_emdash/api/schema/collections/${collection}/fields`, {
			slug: "logos",
			label: "Logos",
			type: "repeater",
			validation: {
				subFields: [
					{ slug: "name", label: "Name", type: "string" },
					{ slug: "logo", label: "Logo", type: "image", darkVariant: true },
				],
			},
		});
		expect(field.data.item.validation.subFields[1]).toMatchObject({ darkVariant: true });

		await admin.goToNewContent(collection);
		await admin.waitForLoading();
		await admin.fillField("title", "Partners");
		await page.getByRole("button", { name: "Add First Item" }).click();
		await expect(page.getByRole("button", { name: "Add dark mode variant" })).toHaveCount(0);

		await page.getByRole("button", { name: "Select image" }).click();
		await pickFromUrl(page, "Select Logo", LIGHT_URL);
		await page.getByRole("button", { name: "Add dark mode variant" }).click();
		await pickFromUrl(page, "Select dark mode variant for Logo", DARK_URL);
		await expect(page.getByRole("button", { name: "Replace dark mode image" })).toBeVisible();

		await admin.clickSave();
		await expect(page).toHaveURL(CONTENT_EDIT_URL_PATTERN, { timeout: 10000 });
		await page.getByRole("button", { name: "Publish now", exact: true }).click();
		await page
			.getByRole("dialog", { name: "Publish now?" })
			.getByRole("button", { name: "Publish now", exact: true })
			.click();
		await expect(page.getByText("Live version", { exact: true })).toBeVisible({ timeout: 10000 });

		const id = page.url().split("/").pop()!;
		const entry = await page.request.get(`/_emdash/api/content/${collection}/${id}`, {
			headers,
		});
		const saved = (await entry.json()) as {
			data: { item: { slug: string; data: { logos: Array<{ logo: Record<string, unknown> }> } } };
		};
		expect(saved.data.item.data.logos[0]!.logo).toMatchObject({
			src: LIGHT_URL,
			darkVariant: { src: DARK_URL },
		});

		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto(`/repeater-logos?collection=${collection}&slug=${saved.data.item.slug}`);
		const light = page.locator(`#logos img.emdash-image--light[src="${LIGHT_URL}"]`);
		const dark = page.locator(`#logos img.emdash-image--dark[src="${DARK_URL}"]`);
		await expect(dark).toBeVisible();
		await expect(light).toHaveCSS("display", "none");
	});
});
