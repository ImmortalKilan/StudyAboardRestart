# Modular Avatar V1 Calibrated

This folder contains the post-processed runtime-ready version of `../modular_v1`.

## Runtime Composition

Use a 72x72 canvas and draw layers in this order:

1. `bg`
2. `body_base`
3. `torso_clothes`
4. `head`
5. `hair`
6. `accessory`
7. `bubble`

There is no `arms` layer in the calibrated set. Clothing sprites already include sleeves and hands, so an extra arms layer duplicates sleeves and causes visible misalignment.

## Files

- `anchors.json`: fixed canvas size, layer order, and anchor metadata for each component.
- `preview_combos_calibrated.png`: sample mixed-gender combinations.
- `preview_female_calibrated.png`: female-focused sample combinations.
- `qa_hair_alignment.png`: all hair overlays tested against fixed head/body anchors.
- `qa_outfit_alignment.png`: all clothing overlays tested without a separate arms layer.
- `qa_combo_stress.png`: mixed story/background combinations for visual stress testing.

The backgrounds are copied from `../modular_v1/bg` and were not regenerated.
