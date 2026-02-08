
document.addEventListener('DOMContentLoaded', function() {
    const ads = [
        {
            title: "CitrusBurn - HOT New WEIGHT LOSS Supplement For 2026",
            image: "https://d2h8hiv6zzm73v.cloudfront.net/legacy/vendors/citrusburn/Gemini_Generated_Image_ji541759417717516.png",
            link: "https://c25cdejmx1-4vm98pl2sxw-nrh.hop.clickbank.net",
            cta: "Learn More"
        },
        {
            title: "MITOLYN - Unlock Your Metabolic Power",
            image: "https://d2h8hiv6zzm73v.cloudfront.net/legacy/vendors/mitolyn/3-blank1731760620764.png",
            link: "https://637849m83au1ps0itsve0fdlfd.hop.clickbank.net",
            cta: "Get Started"
        },
        {
            title: "ProstaVive - Powerhouse Prostate Offer",
            image: "https://d2h8hiv6zzm73v.cloudfront.net/legacy/vendors/provive/6vive-3001747944566183.png",
            link: "https://e1ef9bg8s3yzwv6g1a-3840ycx.hop.clickbank.net",
            cta: "Order Now"
        }
    ];

    const container = document.getElementById('ad-slideshow');
    if (!container) return;

    // Build Slides
    let slidesHtml = '<div class="ad-slideshow-container">';
    
    ads.forEach((ad, index) => {
        slidesHtml += `
            <div class="ad-slide fade ${index === 0 ? 'active' : ''}">
                <a href="${ad.link}" target="_blank" rel="noopener noreferrer" class="ad-content">
                    <img src="${ad.image}" alt="${ad.title}" class="ad-image">
                    <div class="ad-text-content">
                        <div class="ad-title">${ad.title}</div>
                        <div class="ad-cta">${ad.cta}</div>
                    </div>
                </a>
            </div>
        `;
    });

    // Build Dots
    slidesHtml += '<div class="ad-dots">';
    ads.forEach((_, index) => {
        slidesHtml += `<span class="ad-dot ${index === 0 ? 'active' : ''}" onclick="currentSlide(${index + 1})"></span>`;
    });
    slidesHtml += '</div></div>';

    container.innerHTML = slidesHtml;

    // Slideshow Logic
    let slideIndex = 1;
    let slideInterval;

    window.currentSlide = function(n) {
        showSlides(slideIndex = n);
        resetTimer();
    }

    function showSlides(n) {
        let i;
        let slides = document.getElementsByClassName("ad-slide");
        let dots = document.getElementsByClassName("ad-dot");
        
        if (n > slides.length) {slideIndex = 1}    
        if (n < 1) {slideIndex = slides.length}
        
        for (i = 0; i < slides.length; i++) {
            slides[i].classList.remove("active");  
            slides[i].style.display = "none";
        }
        for (i = 0; i < dots.length; i++) {
            dots[i].classList.remove("active");
        }
        
        slides[slideIndex-1].style.display = "block";  
        slides[slideIndex-1].classList.add("active");
        dots[slideIndex-1].classList.add("active");
    }

    function autoShowSlides() {
        slideIndex++;
        showSlides(slideIndex);
    }

    function resetTimer() {
        clearInterval(slideInterval);
        slideInterval = setInterval(autoShowSlides, 5000); // Change image every 5 seconds
    }

    resetTimer();
});
