import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exportSeed } from "../../../src/cli/commands/export-seed.js";
import type { Database } from "../../../src/database/types.js";
import { BlockTypeRegistry } from "../../../src/schema/block-type-registry.js";
import { SchemaRegistry } from "../../../src/schema/registry.js";
import { applySeed } from "../../../src/seed/apply.js";
import type { SeedFile } from "../../../src/seed/types.js";
import { setupTestDatabase, teardownTestDatabase } from "../../utils/test-db.js";

const logoSubFields = [
	{ slug: "name", label: "Name", type: "string" },
	{ slug: "logo", label: "Logo", type: "image", darkVariant: true },
];

const seed: SeedFile = {
	version: "1",
	blockTypes: [
		{
			slug: "logo_strip",
			label: "Logo strip",
			currentVersion: 1,
			versions: [
				{
					version: 1,
					fields: [
						{
							slug: "logos",
							label: "Logos",
							type: "repeater",
							validation: {
								subFields: [{ slug: "logo", label: "Logo", type: "image", darkVariant: true }],
							},
						},
					],
				},
			],
		},
	],
	collections: [
		{
			slug: "pages",
			label: "Pages",
			fields: [
				{
					slug: "logos",
					label: "Logos",
					type: "repeater",
					validation: { subFields: logoSubFields },
				},
				{
					slug: "layout",
					label: "Layout",
					type: "blocks",
					validation: { allowedTypes: ["logo_strip"] },
				},
			],
		},
	],
};

describe("repeater image dark variant in seeds", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("keeps darkVariant on collection and block type image sub-fields through apply and export", async () => {
		await applySeed(db, seed);

		const field = await new SchemaRegistry(db).getField("pages", "logos");
		expect(field?.validation?.subFields).toEqual(logoSubFields);
		const blockType = await new BlockTypeRegistry(db).getBlockType("logo_strip");
		expect(blockType?.versions[0]?.fields[0]?.validation?.subFields?.[0]?.darkVariant).toBe(true);

		const exported = await exportSeed(db, "all");
		const exportedField = exported.collections
			?.find((collection) => collection.slug === "pages")
			?.fields.find((candidate) => candidate.slug === "logos");
		expect(exportedField?.validation?.subFields).toEqual(logoSubFields);
		expect(exported.blockTypes).toEqual(seed.blockTypes);
	});
});
