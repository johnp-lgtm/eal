CUSTOMER REVIEW PHOTOS
======================

The scrolling band on the home page shows photos of customers with their cars
(images only — no captions). The live photos are review-1.jpg … review-5.jpg
in this folder.

TO ADD OR CHANGE A PHOTO:
1. Save the new photo here as a .jpg (e.g. review-6.jpg).
   Tip: keep the longest side around 1000–1200 px and the file under ~300 KB.
2. Open /index.html and find the "REVIEWS / MARQUEE" section.
3. The photos are listed TWICE — "Set A" and "Set B" (an identical duplicate
   that makes the scroll loop seamless). Add/replace your <figure> in BOTH sets
   so they stay in sync, e.g.
       <figure class="review-card"><img class="review-photo"
         src="assets/reviews/review-6.jpg" alt="Easy As Loans customer with their car"
         loading="lazy" /></figure>

DISPLAY:
- Photos are shown in a 300 x 380 px portrait frame and cropped to fill it
  (object-fit: cover), so the centre of each photo is what shows.

TIP: get the customer's permission before publishing their photo.
