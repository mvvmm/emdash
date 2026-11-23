import { describe, it, expect } from "vitest";

import { portableTextToProsemirror } from "../../../src/content/converters/portable-text-to-prosemirror.js";
import { prosemirrorToPortableText } from "../../../src/content/converters/prosemirror-to-portable-text.js";
import type {
	PortableTextBlock,
	PortableTextImageBlock,
} from "../../../src/content/converters/types.js";

const lightImage: PortableTextImageBlock = {
	_type: "image",
	_key: "img1",
	asset: { _ref: "01LIGHT", url: "/_emdash/api/media/file/light.png" },
	alt: "Request flow",
	width: 1600,
	height: 900,
};

const darkVariant = {
	asset: { _ref: "01DARK", url: "/_emdash/api/media/file/dark.png" },
	width: 1600,
	height: 900,
	blurhash: "LEHV6nWB2yk8",
	dominantColor: "#0d0d0d",
};

function roundTrip(blocks: PortableTextBlock[]): PortableTextBlock[] {
	return prosemirrorToPortableText(portableTextToProsemirror(blocks));
}

describe("Image dark variant round-trip", () => {
	it("keeps the dark variant through PT → PM → PT", () => {
		const [out] = roundTrip([{ ...lightImage, darkVariant }]) as PortableTextImageBlock[];

		expect(out!.darkVariant).toEqual(darkVariant);
		expect(out!.asset).toEqual({ _ref: "01LIGHT", url: "/_emdash/api/media/file/light.png" });
		expect(out!.alt).toBe("Request flow");
	});

	it("keeps an external provider on the variant", () => {
		const external = { asset: { _ref: "cf-dark", provider: "cloudflare-images" } };
		const [out] = roundTrip([{ ...lightImage, darkVariant: external }]) as PortableTextImageBlock[];

		expect(out!.darkVariant).toEqual(external);
	});

	it("leaves an image without a variant unchanged", () => {
		const pm = portableTextToProsemirror([lightImage]);
		expect(pm.content[0]!.attrs).not.toHaveProperty("darkVariant");

		const [out] = prosemirrorToPortableText(pm);
		expect(out).not.toHaveProperty("darkVariant");
	});

	it("drops a variant that has no asset reference or URL", () => {
		const [out] = roundTrip([
			{ ...lightImage, darkVariant: { asset: { _ref: "" }, width: 10 } },
		] as PortableTextBlock[]);

		expect(out).not.toHaveProperty("darkVariant");
	});

	it("normalizes a seeded $media asset on the variant", () => {
		const [out] = roundTrip([
			{
				...lightImage,
				darkVariant: {
					asset: {
						provider: "local",
						id: "01DARKSEED",
						width: 800,
						height: 450,
						meta: { storageKey: "01DARKKEY.png" },
					},
				},
			},
		] as PortableTextBlock[]) as PortableTextImageBlock[];

		expect(out!.darkVariant).toEqual({
			asset: { _ref: "01DARKSEED", url: "/_emdash/api/media/file/01DARKKEY.png" },
			width: 800,
			height: 450,
		});
	});
});
