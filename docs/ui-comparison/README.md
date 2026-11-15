# Custos UI comparison

CampusFix uses the visual system in `~/Documents/Code/Check/custos/custos-frontend`. Its maintenance features and role permissions remain in place.

The reference values are Inter Variable at 13.5px / 22px, 15.5px page titles, 180px sidebar, 16px canvas padding, an 820px content column with 40px horizontal padding, 16px cards, 50px controls, 40px inputs, and 36px buttons. The canvas gradients, alpha grays, and brand asset come from the reference. The decorative grass animation was removed from sign-in and sign-up at the user's request. The font is served locally with its license.

Screenshots cover 1440px, 768px, and 375px widths. Reference workspace data uses browser fixtures because the reference API is unavailable. CampusFix screenshots use its working API. Differences in text, navigation destinations, request tables, registration, and role-specific actions reflect CampusFix's features. Navigation icons are local SVGs with the reference's size and stroke treatment.

Three comparison passes checked typography and spacing, workspace surfaces, and responsive overflow. The final pass checked password visibility, registration, request dialogs, and navigation. The request table scrolls within its container on narrow screens.

Validation: production build, TypeScript, 7 unit tests, and all 7 existing browser tests passed. Browser tests ran against an isolated production server and a temporary database copy. The workflow test now assigns its request to the officer it logs in as, rather than the first officer in name order.
