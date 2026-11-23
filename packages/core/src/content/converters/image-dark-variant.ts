/**
 * The dark color scheme variant of a Portable Text image, in its stored form
 * and in the editor's attribute form. Shared by the converters, the inline
 * editor, and seed apply so every path reads and writes the same shape.
 */

import { resolveImageMedia } from "./gallery.js";
import type { PortableTextImageDarkVariant } from "./types.js";

/** A dark variant as an editor image attribute, flat like the image node's own attributes. */
export interface ImageDarkVariantAttrs {
	src: string;
	mediaId?: string;
	provider?: string;
	width?: number;
	height?: number;
	blurhash?: string;
	dominantColor?: string;
}

/**
 * Normalize an untrusted `darkVariant` value. Accepts the stored reference
 * shape and the MediaValue asset that seeded `$media` yields. Returns
 * `undefined` when there is no asset reference or URL to show.
 */
export function sanitizeImageDarkVariant(value: unknown): PortableTextImageDarkVariant | undefined {
	if (!isRecord(value) || !isRecord(value.asset)) return undefined;
	const { asset, width, height } = resolveImageMedia(value);
	if (!asset._ref && !asset.url) return undefined;

	const variant: PortableTextImageDarkVariant = {
		asset: {
			_ref: asset._ref,
			...(asset.url ? { url: asset.url } : {}),
			...(asset.provider ? { provider: asset.provider } : {}),
		},
	};
	const variantWidth = dimension(width);
	const variantHeight = dimension(height);
	if (variantWidth) variant.width = variantWidth;
	if (variantHeight) variant.height = variantHeight;
	const blurhash = nonEmptyString(value.blurhash) ?? nonEmptyString(value.asset.blurhash);
	const dominantColor =
		nonEmptyString(value.dominantColor) ?? nonEmptyString(value.asset.dominantColor);
	if (blurhash) variant.blurhash = blurhash;
	if (dominantColor) variant.dominantColor = dominantColor;
	return variant;
}

/** The editor attribute for a stored `darkVariant`, or `null` when there is none. */
export function imageDarkVariantToAttrs(value: unknown): ImageDarkVariantAttrs | null {
	const variant = sanitizeImageDarkVariant(value);
	if (!variant) return null;
	const attrs: ImageDarkVariantAttrs = { src: variant.asset.url ?? "" };
	if (variant.asset._ref) attrs.mediaId = variant.asset._ref;
	if (variant.asset.provider) attrs.provider = variant.asset.provider;
	if (variant.width) attrs.width = variant.width;
	if (variant.height) attrs.height = variant.height;
	if (variant.blurhash) attrs.blurhash = variant.blurhash;
	if (variant.dominantColor) attrs.dominantColor = variant.dominantColor;
	return attrs;
}

/** The stored `darkVariant` for an editor attribute, or `undefined` when there is none. */
export function imageDarkVariantFromAttrs(
	value: unknown,
): PortableTextImageDarkVariant | undefined {
	if (!isRecord(value)) return undefined;
	const src = nonEmptyString(value.src);
	const ref = nonEmptyString(value.mediaId) ?? src;
	if (!ref) return undefined;
	const provider = nonEmptyString(value.provider);

	const variant: PortableTextImageDarkVariant = {
		asset: {
			_ref: ref,
			...(src ? { url: src } : {}),
			...(provider && provider !== "local" ? { provider } : {}),
		},
	};
	const width = dimension(value.width);
	const height = dimension(value.height);
	const blurhash = nonEmptyString(value.blurhash);
	const dominantColor = nonEmptyString(value.dominantColor);
	if (width) variant.width = width;
	if (height) variant.height = height;
	if (blurhash) variant.blurhash = blurhash;
	if (dominantColor) variant.dominantColor = dominantColor;
	return variant;
}

function dimension(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
