# Modular Avatar V1 Assets

This folder contains the first image2-generated modular bust avatar batch.

## Locked Style

- Upper-body bust avatar, no legs.
- Character uses chunky lower-pixel-density game-sprite rendering.
- Backgrounds may be more detailed and richer in warm lighting than the character.
- 3/4 view facing slightly down-left.
- Normal light peach skin tone for this first pass.
- Chestnut hair, cozy RPG readability, crisp pixel edges.
- Torso reaches the bottom edge and is cropped naturally.
- Clothes include sleeves and hands in this batch.
- Mood/status bubbles sit in the top-right area.

## Folders

- `_sheets/`: original generated sprite sheets used for cropping.
- `bg/`: 12 opaque 72x72 backgrounds.
- `body_base/`: 6 body bases for two genders and three health builds.
- `head/`: 6 heads for two genders and three expression states.
- `hair/`: 20 hair overlays, including multiple colors and female styles.
- `torso_clothes/`: 32 clothing layers, including 16 female-focused variants. Clothing sprites include sleeves/hands.
- `bubble/`: 12 mood/status bubbles.
- `accessory/`: 4 starter accessories.
- `preview_combos.png`: generated local preview of sample layer combinations.

## Notes

The transparent component sheets were generated on chroma backgrounds and then cropped to 72x72 PNGs with alpha. These are first-pass assets for visual exploration and runtime integration testing. Some layer pairs may still need hand cleanup or stricter per-asset generation before final production use.

The v1.1 expansion adds hair color variety and female-focused clothes. The separate `arms` layer was removed because sleeves/hands are already present in the clothing sprites; drawing both caused duplicated sleeves and alignment bugs.
