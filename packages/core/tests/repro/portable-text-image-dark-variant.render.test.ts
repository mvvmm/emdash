import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, test } from "vitest";

import Image from "../../src/components/Image.astro";

const locals = {
	emdash: { getPublicMediaUrl: (key: string) => `https://cdn.example.com/${key}` },
};

const node = {
	_type: "image",
	_key: "img1",
	asset: { _ref: "01LIGHT", url: "https://media.example.com/light.png" },
	alt: "Request flow",
	caption: "How a request travels",
	width: 1600,
	height: 900,
	dominantColor: "#ffffff",
};
const darkVariant = {
	asset: { _ref: "01DARK", url: "https://media.example.com/dark.png" },
	width: 1600,
	height: 900,
	dominantColor: "#000000",
};

const imgTags = (html: string) => html.match(/<img\b[^>]*>/g) ?? [];
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

async function render(props: Record<string, unknown>) {
	const container = await AstroContainer.create();
	return container.renderToString(Image, { props, locals });
}

describe("Portable Text image dark variant", () => {
	test("an image without a variant renders one <img> without variant classes", async () => {
		const html = await render({ node });
		const tags = imgTags(html);

		expect(tags).toHaveLength(1);
		expect(attr(tags[0]!, "class") ?? "").not.toContain("emdash-image--");
	});

	test("a stored variant renders a second <img> marked for the dark scheme", async () => {
		const html = await render({ node: { ...node, darkVariant } });
		const [lightTag, darkTag] = imgTags(html);

		expect(imgTags(html)).toHaveLength(2);
		expect(attr(lightTag!, "src")).toBe("https://media.example.com/light.png");
		expect(attr(lightTag!, "class")).toContain("emdash-image--light");
		expect(attr(darkTag!, "src")).toBe("https://media.example.com/dark.png");
		expect(attr(darkTag!, "class")).toContain("emdash-image--dark");
		expect(html.match(/<figcaption/g)).toHaveLength(1);
	});

	test("both images share the node's alt and each keeps its own placeholder", async () => {
		const html = await render({ node: { ...node, darkVariant } });
		const [lightTag, darkTag] = imgTags(html);

		expect(attr(lightTag!, "alt")).toBe("Request flow");
		expect(attr(darkTag!, "alt")).toBe("Request flow");
		expect(attr(lightTag!, "style")).toContain("#ffffff");
		expect(attr(darkTag!, "style")).toContain("#000000");
	});

	test("the display width applies to the variant at its own aspect ratio", async () => {
		const html = await render({
			node: {
				...node,
				displayWidth: 800,
				darkVariant: { ...darkVariant, width: 1000, height: 1000 },
			},
		});
		const [lightTag, darkTag] = imgTags(html);

		expect([attr(lightTag!, "width"), attr(lightTag!, "height")]).toEqual(["800", "450"]);
		expect([attr(darkTag!, "width"), attr(darkTag!, "height")]).toEqual(["800", "800"]);
	});

	test("both images sit inside the link when the node has one", async () => {
		const html = await render({ node: { ...node, darkVariant, link: { href: "/docs" } } });
		const anchor = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "";

		expect(imgTags(anchor)).toHaveLength(2);
	});

	test("a variant without an asset reference or URL is ignored", async () => {
		const html = await render({ node: { ...node, darkVariant: { asset: { _ref: "" } } } });

		expect(imgTags(html)).toHaveLength(1);
	});
});
