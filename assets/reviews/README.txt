CUSTOMER REVIEW PHOTOS
======================

The scrolling band on the home page shows photos of customers with their cars.
Right now it uses placeholder images (review-1.svg … review-6.svg).

TO ADD YOUR REAL PHOTOS:
1. Save each photo in this folder. JPGs are ideal, e.g. review-1.jpg.
2. Open /index.html and find the "REVIEWS / MARQUEE" section.
3. For each <img>, change the src, e.g.
       src="assets/reviews/review-1.svg"   ->   src="assets/reviews/review-1.jpg"
   The list appears TWICE (Set A and Set B) — they must match so the loop
   stays seamless. Update both copies of each photo.
4. Update the name/quote text in the <figcaption> beside each photo.

RECOMMENDED IMAGE SIZE:
- Around 800 x 600 px (landscape), under ~300 KB each for fast loading.
- Photos are cropped to fill a 300 x 200 px frame on the page.

TIP: get the customer's permission before publishing their photo.
