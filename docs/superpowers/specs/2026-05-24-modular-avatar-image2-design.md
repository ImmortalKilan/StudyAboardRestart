# Modular Avatar Image2 Design

## Goal

Replace the current runtime-drawn avatar direction with an image2-generated modular pixel-art avatar system. The system should feel like a cozy RPG portrait inspired by Stardew Valley-style readability, while remaining original and tailored to the study-abroad life simulator.

The immediate scope is visual design and asset specification only. No runtime code changes are part of this design step.

## Recommended Direction

Use upper-body bust avatars instead of full-body sprites. The character should fill the avatar frame clearly, with the torso continuing to the bottom edge so it reads as a natural portrait crop rather than a floating half-body.

All pieces must share a fixed 72x72 logical canvas and identical anchors. They should work like paper-doll layers: any compatible head, hair, outfit, arms, background, accessory, or mood bubble can stack without shifting.

## Layer Stack

Render order from bottom to top:

1. `bg`
2. `body_base`
3. `torso_clothes`
4. `arms`
5. `head`
6. `hair`
7. `accessory`
8. `bubble`

Each layer uses the same 72x72 canvas coordinate space.

## Layer Requirements

### `bg`

Opaque 72x72 background. It reflects storylines, life stage, or major context. Examples include overseas dorm, campus library, office, gym, cafe date, xianxia mountain temple, Hogwarts corridor, esports room, casino, idol practice room, and chef kitchen.

### `body_base`

Light peach skin tone only for the first version. Includes neck, shoulders, relaxed side-arm guide, and small hands near the lower side edges. No clothes, no head, no hair. Torso and arms must extend naturally to the bottom crop.

Health affects this layer:

- Low HLT: slimmer body, slouched shoulders, tired posture.
- Mid HLT: normal build.
- High HLT: fitter build, upright posture.

### `head`

Face, ears, and neck stub only. No hair. The skull top must be bare so hair overlays cleanly. Keep expressions simple to avoid asset explosion:

- neutral
- happy
- tired/sad

### `hair`

Hair only. No skin, face, neck, or accessories. It must align exactly to the head anchor. Initial styles should include short fluffy hair, messy hair, long hair, ponytail, bob, and bun.

### `torso_clothes`

Torso clothing only. No arms or hands. Neckline and shoulders must align with `body_base`. Torso clothing should continue to the bottom crop.

Outfits reflect life stage, profession, and storyline: school uniform, student hoodie, cardigan, blazer, office shirt, suit, lab coat, chef coat, gym top, idol outfit, cultivation robe, esports jersey, wizard robe, party outfit, and low-money worn clothes.

### `arms`

Sleeves and hands only. Arms hang naturally along the torso sides. Hands should be small, relaxed, and near the lower side edges, partially cropped if needed. Avoid palms-forward, elbows-on-table, crossed arms, or hands floating in front of the chest.

### `accessory`

Optional overlay for glasses, headphones, backpack straps, badges, wand, headset mic, spirit beads, work pass, or similar details.

### `bubble`

Small mood/status bubble fixed in the top-right coordinate area. Target center is approximately `x=54, y=14`. This layer is the primary place to show fast-changing emotional and relationship state without requiring many face variants.

Examples:

- Happy: small sun/sparkle.
- Stressed: blue swirl.
- Tired/sick: sleep mark or medical cross.
- In love: pink heart.
- Broken up: cracked heart.
- Rich: coin.
- Academic danger: warning mark/book.
- Special storyline: trophy, controller, jade bead, wand, microphone, chef hat, casino chip.

## State Mapping

Use these visual channels:

- HLT affects `body_base` build and posture.
- HAP and relationship affect `bubble`, with only coarse fallback expression changes in `head`.
- Storyline affects `bg`, `torso_clothes`, `accessory`, and sometimes `bubble`.
- Life stage/profession affects `torso_clothes` and `bg`.
- MNY can affect outfit quality and background richness.
- APP can eventually choose face polish variants, but is not required for the first asset batch.
- Skin tone is out of scope for the first pass; use a normal light peach skin tone.

## Image2 Generation Standard

Every generated asset prompt must enforce:

- 72x72 logical canvas.
- Upper-body bust only, no legs.
- 3/4 view facing slightly down-left.
- Hard square pixels, no anti-aliasing, no blur, no gradients.
- Dark 1-pixel outline.
- Limited palette, roughly 8 to 10 colors per component.
- Same head anchor, shoulder anchor, torso crop, and bubble position across all pieces.
- Transparent background for all layers except `bg`.
- Strict layer separation: a layer must not include pixels belonging to another layer.

## First Validation Sheet

The next image2 output should be an 8-slot layer sheet:

1. `bg` dorm only.
2. `body_base` normal build only.
3. `head` bare skull only.
4. `hair` only.
5. `torso_clothes` hoodie only.
6. `arms` hoodie sleeves and small hands only.
7. `bubble` only.
8. assembled avatar from the exact same parts.

Success criteria:

- The assembled slot appears to be made from the visible component slots.
- The torso does not float.
- Hands hang naturally at the sides.
- The head is more 3/4 than front-facing.
- There is enough top-right space for the bubble.
- Component slots are clean enough to become future transparent PNG assets.

## Deferred Work

Runtime integration, asset loading, randomized selection, and GitHub push workflow are intentionally deferred until the visual spec is approved.
