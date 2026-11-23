import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import { RepeaterField } from "../../src/components/RepeaterField";
import { render } from "../utils/render.tsx";

vi.mock("../../src/components/MediaPickerModal", () => ({
	MediaPickerModal: ({ open, onSelect }: { open: boolean; onSelect: (item: unknown) => void }) =>
		open ? (
			<button
				type="button"
				onClick={() =>
					onSelect({
						id: "picked",
						filename: "picked.png",
						mimeType: "image/png",
						url: "/_emdash/api/media/file/picked.png",
						storageKey: "picked.png",
						provider: "local",
						size: 100,
						width: 200,
						height: 100,
						createdAt: "2026-11-01T00:00:00.000Z",
					})
				}
			>
				Choose picked
			</button>
		) : null,
}));

vi.mock("../../src/lib/api/current-user.js", () => ({
	useCurrentUser: () => ({ data: { id: "editor-1", role: 40 } }),
}));

const light = {
	id: "light",
	provider: "local",
	filename: "logo-light.png",
	meta: { storageKey: "logo-light.png" },
};
const dark = {
	id: "dark",
	provider: "local",
	filename: "logo-dark.png",
	meta: { storageKey: "logo-dark.png" },
};

function renderLogos(
	row: Record<string, unknown>,
	onChange: (value: unknown[]) => void,
	darkVariant?: boolean,
) {
	return render(
		<RepeaterField
			label="Logos"
			id="logos"
			value={[row]}
			onChange={onChange}
			subFields={[
				{ slug: "name", type: "string", label: "Name" },
				{ slug: "logo", type: "image", label: "Logo", darkVariant },
			]}
		/>,
	);
}

describe("RepeaterField image dark variant", () => {
	it("offers no dark mode slot unless the sub-field enables it", async () => {
		const screen = await renderLogos({ name: "Acme", logo: light }, vi.fn());

		await expect.element(screen.getByRole("button", { name: "Remove image" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Add dark mode variant" }).query()).toBeNull();
	});

	it("offers the slot only once the row has a primary image", async () => {
		const screen = await renderLogos({ name: "Acme", logo: null }, vi.fn(), true);

		await expect.element(screen.getByRole("button", { name: /Select image/ })).toBeVisible();
		expect(screen.getByRole("button", { name: "Add dark mode variant" }).query()).toBeNull();
	});

	it("stores the picked variant under the row's image value", async () => {
		const onChange = vi.fn();
		const screen = await renderLogos({ name: "Acme", logo: light }, onChange, true);

		await screen.getByRole("button", { name: "Add dark mode variant" }).click();
		await screen.getByRole("button", { name: "Choose picked" }).click();

		expect(onChange).toHaveBeenLastCalledWith([
			{
				name: "Acme",
				logo: { ...light, darkVariant: expect.objectContaining({ id: "picked" }) },
			},
		]);
	});

	it("keeps the variant when the primary image is replaced", async () => {
		const onChange = vi.fn();
		const screen = await renderLogos({ logo: { ...light, darkVariant: dark } }, onChange, true);

		await screen.getByRole("button", { name: "Replace", exact: true }).click();
		await screen.getByRole("button", { name: "Choose picked" }).click();

		expect(onChange).toHaveBeenLastCalledWith([
			{ logo: expect.objectContaining({ id: "picked", darkVariant: dark }) },
		]);
	});

	it("clears the variant with the primary image", async () => {
		const onChange = vi.fn();
		const screen = await renderLogos({ logo: { ...light, darkVariant: dark } }, onChange, true);

		await expect.element(screen.getByText("logo-dark.png")).toBeVisible();
		await screen.getByRole("button", { name: "Remove image" }).click();

		expect(onChange).toHaveBeenLastCalledWith([{ logo: null }]);
	});
});
