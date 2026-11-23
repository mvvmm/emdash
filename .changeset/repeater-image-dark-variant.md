---
"emdash": minor
"@emdash-cms/admin": minor
---

Adds an opt-in dark mode variant to `image` sub-fields in repeaters, so editors can pick a second image for dark color schemes in each row, such as a logo strip. Set `darkVariant: true` on the sub-field, next to its `type`, or switch on **Dark mode variant** for the sub-field in the field editor:

```json
{ "slug": "logo", "label": "Logo", "type": "image", "darkVariant": true }
```

It works in collection repeaters and in repeaters inside block types. The variant is stored under the row's image value as `darkVariant`, the same shape as top-level image fields, so `<Image image={row.logo} />` renders both images with no template change. The schema API, block type validation, and seed validation reject `darkVariant` on a sub-field that is not an `image`, or with a non-boolean value. In a block type, a list whose image sub-field sets `darkVariant` opens its items to edit them instead of showing a table.
