import type { Page } from "@playwright/test";

import { test, expect } from "../fixtures";

const LIGHT_URL = "https://media.example.test/diagram-light.png";
const DARK_URL = "https://media.example.test/diagram-dark.png";

const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

function imageNode(darkVariant?: Record<string, unknown>) {
	return {
		_type: "image",
		_key: "diagram",
		asset: { _ref: "", url: LIGHT_URL },
		alt: "Request flow",
		width: 200,
		height: 100,
		...(darkVariant ? { darkVariant } : {}),
	};
}

async function createPost(
	page: Page,
	headers: Record<string, string>,
	slug: string,
	body: unknown[],
): Promise<string> {
	const response = await page.request.post("/_emdash/api/content/posts", {
		headers,
		data: { slug, data: { title: slug, body } },
	});
	expect(response.ok(), await response.text()).toBe(true);
	const created = (await response.json()) as { data: { item: { id: string } } };
	return created.data.item.id;
}

test.describe("Portable Text image dark variant", () => {
	let headers: Record<string, string>;

	test.beforeEach(async ({ admin, page, serverInfo }) => {
		await page.route("https://media.example.test/**", (route) =>
			route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG }),
		);
		await admin.devBypassAuth();
		headers = {
			Authorization: `Bearer ${serverInfo.token}`,
			"X-EmDash-Request": "1",
			Origin: serverInfo.baseUrl,
		};
	});

	test("renders the image for the visitor's color scheme", async ({ page }) => {
		const slug = "pt-image-dark-render";
		const id = await createPost(page, headers, slug, [
			imageNode({ asset: { _ref: "", url: DARK_URL }, width: 200, height: 100 }),
		]);
		const published = await page.request.post(`/_emdash/api/content/posts/${id}/publish`, {
			headers,
			data: {},
		});
		expect(published.ok(), await published.text()).toBe(true);

		const light = page.locator(`#body figure img.emdash-image--light[src="${LIGHT_URL}"]`);
		const dark = page.locator(`#body figure img.emdash-image--dark[src="${DARK_URL}"]`);

		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto(`/posts/${slug}`);
		await expect(dark).toBeVisible();
		await expect(light).toHaveCSS("display", "none");
		await expect(dark).toHaveAttribute("alt", "Request flow");

		await page.emulateMedia({ colorScheme: "light" });
		await expect(light).toBeVisible();
		await expect(dark).toHaveCSS("display", "none");
	});

	test("adds a variant from the image settings and keeps it on save", async ({ admin, page }) => {
		const id = await createPost(page, headers, "pt-image-dark-editor", [imageNode()]);

		await admin.goToEditContent("posts", id);
		await admin.waitForLoading();
		await page.getByRole("img", { name: "Request flow" }).click();
		await page.getByRole("button", { name: "Image settings" }).click();

		await page.getByRole("button", { name: "Add dark mode variant" }).click();
		const picker = page.getByRole("dialog", { name: "Select dark mode variant" });
		await picker.getByRole("tab", { name: "From URL" }).click();
		await picker.getByLabel("Image URL").fill(DARK_URL);
		await picker.getByRole("button", { name: "Use URL" }).click();
		await picker.getByRole("button", { name: "Select", exact: true }).click();
		await expect(picker).toBeHidden();
		await expect(page.getByRole("button", { name: "Remove dark mode variant" })).toBeVisible();

		await admin.clickSave();
		await admin.waitForSaveComplete();

		const response = await page.request.get(`/_emdash/api/content/posts/${id}`, { headers });
		const saved = (await response.json()) as {
			data: { item: { data: { body: Array<Record<string, unknown>> } } };
		};
		const [image] = saved.data.item.data.body;
		expect(image).toMatchObject({
			asset: { url: LIGHT_URL },
			darkVariant: { asset: { url: DARK_URL } },
		});
	});
});
