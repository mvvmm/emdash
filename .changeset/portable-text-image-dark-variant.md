---
"emdash": minor
"@emdash-cms/admin": minor
---

Adds a dark mode variant for images in Portable Text fields. Set `options: { darkVariant: true }` on a `portableText` field, or switch on **Dark mode variant** when you edit the field, and the image settings panel offers **Add dark mode variant** for each image in the text. The option also works on `portableText` fields in block types, and rich text inside a block now has the image settings panel. The variant is stored on the image node as `darkVariant: { asset, width?, height?, blurhash?, dominantColor? }`, in the same shape as the node's own asset, and shares the image's alt text, caption, link, alignment, and display size.

`PortableText` renders both images with the `emdash-image--light` and `emdash-image--dark` classes that `Image` uses, so templates need no change. Seed files can give the variant's `asset` a `$media` reference, and media usage records the variant at `<path>.darkVariant`. Image nodes without a variant are stored and rendered as before.
