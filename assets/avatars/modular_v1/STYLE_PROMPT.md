# Modular Avatar V1 Style Prompt

Use this prompt language when extending the asset set:

```text
Create a modular upper-body bust avatar asset for a life-simulation game.

Character style is locked:
- young international student avatar
- chunky lower-pixel-density cozy RPG sprite rendering
- 3/4 view facing slightly down-left
- normal light peach skin tone
- chestnut hair when hair is present
- crisp pixel edges and dark outline
- broad readable shapes, not fine illustration detail
- warm simple character lighting
- no legs, upper-body bust only
- torso naturally reaches and is cropped by the bottom edge
- arms hang down naturally along the sides
- tiny relaxed hands near lower side edges

Background style is separate:
- backgrounds may be more detailed and richer than the character
- warm dorm/campus-style lighting is preferred when appropriate
- still pixel art, no smooth painting or vector look

Modularity rules:
- every asset uses the same 72x72 coordinate system
- head anchor, shoulder anchor, torso crop, and bubble position must stay fixed
- `head` has no hair
- `hair` has no face or skin
- `torso_clothes` has no arms or hands
- `arms` has only sleeves and hands
- `bubble` sits in the top-right area
- `bg` is opaque and contains no character

Avoid:
- full body or legs
- floating torso or blank gap under the body
- hands on a table, palms forward, crossed arms, or hands near the chest
- changing the locked character style
- making the character too detailed
- inconsistent anchors between layers
- text, labels, watermarks, UI
```

For transparent component sheets, use a chroma key color that does not conflict with the asset palette. The first batch used pure magenta `#ff00ff`, then removed that color locally.
