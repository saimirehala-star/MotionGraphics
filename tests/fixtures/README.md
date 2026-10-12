# Native migration fixtures

`MotionGraphics-1.1.0.jsx` is the frozen, previously delivered single-file 1.1.0 build. SHA256: `76b0ad40a3ca46b22e580c8c18738705846bd518c6c328c277946f36c562b6ef`.

`MotionGraphics-1.2.0.jsx` is the frozen, previously delivered source-layer range build. SHA256: `ba32648a19a80f6cbb0ad1a11a54bd12743223572ec0f0e4e6dbea18cf9ccece`.

`MotionGraphics-1.3.0.jsx` preserves the previous marker-deletion build before the compact panel changes. SHA256: `abfd39c306988a592b91c56ccc600927db93dff83e11ec7c60bf66c922e2845b`.

`MotionGraphics-1.4.0.jsx` preserves the compact-panel build before the loop-range default changed. SHA256: `7082515fee87009421de6eb8efef211a318191fe04be9ca6f6d7db8578d2e0a4`.

The guarded native test runner loads these engines to create real legacy animations, then loads the current standalone build to verify migration and explicit deletion opt-in. Do not rebuild or update these fixtures with current sources. They are not part of the customer distribution.
