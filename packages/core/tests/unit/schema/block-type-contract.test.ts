import { describe, expect, it } from "vitest";

import { mapErrorStatus } from "../../../src/api/errors.js";
import {
	canonicalBlockFields,
	compareBlockFields,
	fingerprintBlockFields,
	validateBlockFields,
} from "../../../src/schema/block-type-contract.js";
import type { BlockFieldDefinition } from "../../../src/schema/block-types.js";
import type { RepeaterSubField } from "../../../src/schema/types.js";

const baseFields: BlockFieldDefinition[] = [
	{
		slug: "heading",
		label: "Heading",
		type: "string",
		required: true,
		validation: { minLength: 2, maxLength: 80 },
	},
	{
		slug: "items",
		label: "Items",
		type: "repeater",
		validation: {
			maxItems: 4,
			subFields: [
				{
					slug: "kind",
					label: "Kind",
					type: "select",
					options: ["news", "guide"],
				},
			],
		},
	},
];

describe("block type contracts", () => {
	it("maps stable registry errors to resource and conflict statuses", () => {
		expect(mapErrorStatus("BLOCK_TYPE_NOT_FOUND")).toBe(404);
		expect(mapErrorStatus("BLOCK_TYPE_EXISTS")).toBe(409);
		expect(mapErrorStatus("BLOCK_TYPE_BREAKING_CHANGE")).toBe(409);
		expect(mapErrorStatus("BLOCK_TYPE_VERSION_CONFLICT")).toBe(409);
	});

	it("produces stable fingerprints that exclude presentation labels", async () => {
		const renamed = baseFields.map((field) => ({ ...field, label: `New ${field.label}` }));

		expect(canonicalBlockFields(renamed)).toBe(canonicalBlockFields(baseFields));
		expect(await fingerprintBlockFields(renamed)).toBe(await fingerprintBlockFields(baseFields));
	});

	it("accepts image repeater MIME validation and detects narrowing", () => {
		const before = [
			{
				slug: "items",
				label: "Items",
				type: "repeater" as const,
				validation: {
					subFields: [
						{
							slug: "logo",
							label: "Logo",
							type: "image" as const,
							validation: { allowedMimeTypes: ["image/svg+xml", "image/png"] },
						},
					],
				},
			},
		];
		validateBlockFields(before);
		const after = structuredClone(before);
		after[0]!.validation.subFields[0]!.validation.allowedMimeTypes = ["image/png"];
		const result = compareBlockFields(before, after);
		expect(result.compatible).toBe(false);
		expect(result.differences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "fields.items.validation.subFields.logo.validation.allowedMimeTypes",
					compatibility: "breaking",
				}),
			]),
		);
	});

	it("classifies additive and loosened changes as compatible", () => {
		const next: BlockFieldDefinition[] = [
			{
				...baseFields[0]!,
				validation: { minLength: 1, maxLength: 120 },
			},
			{
				...baseFields[1]!,
				validation: {
					...baseFields[1]!.validation,
					maxItems: 8,
					subFields: [
						{
							slug: "kind",
							label: "Kind",
							type: "select",
							options: ["news", "guide", "video"],
						},
					],
				},
			},
			{ slug: "eyebrow", label: "Eyebrow", type: "string" },
		];

		const result = compareBlockFields(baseFields, next);

		expect(result.compatible).toBe(true);
		expect(result.differences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "fields.eyebrow", compatibility: "compatible" }),
				expect.objectContaining({
					path: "fields.items.validation.subFields.kind.validation.options",
					compatibility: "compatible",
				}),
			]),
		);
	});

	it("classifies removals, required additions, narrowing, and nested changes as breaking", () => {
		const next: BlockFieldDefinition[] = [
			{
				...baseFields[1]!,
				validation: {
					maxItems: 2,
					subFields: [
						{
							slug: "kind",
							label: "Kind",
							type: "select",
							options: ["news"],
						},
					],
				},
			},
			{ slug: "summary", label: "Summary", type: "text", required: true },
		];

		const result = compareBlockFields(baseFields, next);

		expect(result.compatible).toBe(false);
		expect(result.differences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "fields.heading", compatibility: "breaking" }),
				expect.objectContaining({ path: "fields.summary", compatibility: "breaking" }),
				expect.objectContaining({
					path: "fields.items.validation.subFields.kind.validation.options",
					compatibility: "breaking",
				}),
			]),
		);
	});

	it("rejects invalid definitions with a stable field path", () => {
		expect(() => validateBlockFields([{ slug: "_key", label: "Key", type: "string" }])).toThrow(
			/fields\[0\]\.slug/,
		);
		expect(() =>
			validateBlockFields([
				{
					slug: "choice",
					label: "Choice",
					type: "select",
					validation: { options: ["one", "one"] },
				},
			]),
		).toThrow(/fields\[0\]\.validation\.options/);
		expect(() =>
			validateBlockFields([
				{
					slug: "rows",
					label: "Rows",
					type: "repeater",
					validation: {
						subFields: [{ slug: "nested", label: "Nested", type: "portableText" as "string" }],
					},
				},
			]),
		).toThrow(/fields\[0\]\.validation\.subFields\[0\]\.type/);
	});

	describe("repeater image dark variant", () => {
		const logos = (darkVariant?: unknown): BlockFieldDefinition[] => [
			{
				slug: "logos",
				label: "Logos",
				type: "repeater",
				validation: {
					subFields: [
						{
							slug: "logo",
							label: "Logo",
							type: "image",
							...(darkVariant === undefined ? {} : { darkVariant }),
						} as RepeaterSubField,
					],
				},
			},
		];

		it("accepts the flag on an image sub-field and keeps it", () => {
			const [field] = validateBlockFields(logos(true));
			expect(field!.validation?.subFields?.[0]?.darkVariant).toBe(true);
		});

		it("rejects a non-boolean flag", () => {
			expect(() => validateBlockFields(logos("yes"))).toThrow(
				/fields\[0\]\.validation\.subFields\[0\]\.darkVariant: must be a boolean/,
			);
		});

		it("rejects the flag on a sub-field that is not an image", () => {
			expect(() =>
				validateBlockFields([
					{
						slug: "rows",
						label: "Rows",
						type: "repeater",
						validation: {
							subFields: [{ slug: "name", label: "Name", type: "string", darkVariant: true }],
						},
					},
				]),
			).toThrow(/subFields\[0\]\.darkVariant: is not supported for type "string"/);
		});

		it("still reads stored definitions that carry an invalid flag", () => {
			const stored = [
				{
					slug: "rows",
					label: "Rows",
					type: "repeater" as const,
					validation: {
						subFields: [
							{ slug: "name", label: "Name", type: "string" as const, darkVariant: true },
						],
					},
				},
			];
			expect(validateBlockFields(stored, { mode: "read" })).toEqual(stored);
		});

		it("changes the fingerprint and reports turning the slot on as compatible", async () => {
			expect(await fingerprintBlockFields(logos(true))).not.toBe(
				await fingerprintBlockFields(logos()),
			);
			expect(compareBlockFields(logos(), logos(true))).toEqual({
				compatible: true,
				differences: [
					{
						path: "fields.logos.validation.subFields.logo.options.darkVariant",
						change: "dark variant changed",
						compatibility: "compatible",
					},
				],
			});
		});

		it("reports turning the slot off as breaking", () => {
			const result = compareBlockFields(logos(true), logos(false));
			expect(result.compatible).toBe(false);
			expect(result.differences).toEqual([
				expect.objectContaining({
					path: "fields.logos.validation.subFields.logo.options.darkVariant",
					compatibility: "breaking",
				}),
			]);
		});
	});
});
