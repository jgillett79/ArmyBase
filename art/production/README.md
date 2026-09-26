# Production-ready static range foreground props

The two PNGs in `assets/props/` are individual transparent sprites with cleaned red edge artifacts, four-pixel padding and explicit ground pivots in `range-berms.json`. They were inspected at their 228-pixel native width. Both may be rendered in front of a soldier at the two range stations; keep the range ground and targets behind the soldiers. Brief 2 owns the stable slot coordinates and Brief 4 should adjust prop placement once the exact station geometry is final.

These are **static foreground props**. They do not solve character locomotion or provide a finished gate animation. The generated character studies in `art/concepts/` are not approved sprite sheets because several walk poses repeat and the facing directions are incomplete. The two gate arm studies also have a moving hinge/plinth and are not approved for animation. Do not register those studies as production assets without redrawing and validating them.
