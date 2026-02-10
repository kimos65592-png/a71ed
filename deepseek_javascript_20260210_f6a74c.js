// عناصر DOM
const cityElement = document.getElementById('city');
const currentTimeElement = document.getElementById('current-time');
const hijriDateElement = document.getElementById('hijri-date');
const nextPrayerNameElement = document.getElementById('next-prayer-name');
const nextPrayerTimeElement = document.getElementById('next-prayer-time');
const countdownElement = document.getElementById('countdown');
const playAdhanButton = document.getElementById('play-adhan');
const stopAdhanButton = document.getElementById('stop-adhan');
const refreshLocationButton = document.getElementById('refresh-location');
const calculationMethodSelect = document.getElementById('calculation-method');
const adhanAudio = document.getElementById('adhan-audio');

// عناصر أوقات الصلاة
const prayerTimeElements = {
    fajr: document.getElementById('fajr-time'),
    sunrise: document.getElementById('sunrise-time'),
    dhuhr: document.getElementById('dhuhr-time'),
    asr: document.getElementById('asr-time'),
    maghrib: document.getElementById('maghrib-time'),
    isha: document.getElementById('isha-time')
};

// متغيرات التطبيق
let userLocation = null;
let prayerTimes = null;
let nextPrayer = null;
let countdownInterval = null;
let currentPrayerCard = null;

// أسماء الصلوات بالعربية
const prayerNames = {
    fajr: 'الفجر',
    sunrise: 'الشروق',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء'
};

// تهيئة التطبيق
async function initApp() {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    await getUserLocation();
    
    if (userLocation) {
        await fetchPrayerTimes();
        startCountdown();
    }
    
    setupEventListeners();
}

// تحديث الوقت الحالي
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-EG', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
    currentTimeElement.textContent = timeString;
    
    // تحديث التاريخ الهجري مرة واحدة فقط عند التحميل
    if (!hijriDateElement.dataset.initialized) {
        updateHijriDate(now);
        hijriDateElement.dataset.initialized = true;
    }
}

// تحديث التاريخ الهجري
function updateHijriDate(date) {
    const hijri = new Intl.DateTimeFormat('ar-TN-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
    }).format(date);
    
    hijriDateElement.textContent = hijri;
}

// الحصول على موقع المستخدم
async function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            cityElement.textContent = 'المتصفح لا يدعم تحديد الموقع';
            resolve(false);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                try {
                    const cityName = await getCityName(userLocation);
                    cityElement.textContent = cityName;
                } catch (error) {
                    cityElement.textContent = `خط الطول: ${userLocation.latitude.toFixed(2)}, خط العرض: ${userLocation.longitude.toFixed(2)}`;
                }
                
                resolve(true);
            },
            async (error) => {
                console.error('خطأ في تحديد الموقع:', error);
                
                // استخدام موقع افتراضي (مكة المكرمة)
                userLocation = {
                    latitude: 21.4225,
                    longitude: 39.8262
                };
                
                cityElement.textContent = 'مكة المكرمة (موقع افتراضي)';
                resolve(true);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
}

// الحصول على اسم المدينة من الإحداثيات
async function getCityName(location) {
    try {
        const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.latitude}&longitude=${location.longitude}&localityLanguage=ar`
        );
        const data = await response.json();
        return data.city || data.locality || data.principalSubdivision || 'موقع غير معروف';
    } catch (error) {
        throw new Error('فشل في الحصول على اسم المدينة');
    }
}

// جلب أوقات الصلاة من API
async function fetchPrayerTimes() {
    if (!userLocation) return;
    
    const method = calculationMethodSelect.value;
    
    try {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        const [year, month, day] = dateString.split('-');
        
        const response = await fetch(
            `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&method=${method}`
        );
        
        const data = await response.json();
        
        if (data.code === 200) {
            prayerTimes = data.data.timings;
            updatePrayerTimesDisplay();
            calculateNextPrayer();
            updateHijriDate(new Date(data.data.date.gregorian.date));
        }
    } catch (error) {
        console.error('خطأ في جلب أوقات الصلاة:', error);
        cityElement.textContent += ' (خطأ في جلب المواقيت)';
        
        // استخدام أوقات افتراضية في حالة الخطأ
        useDefaultPrayerTimes();
    }
}

// استخدام أوقات افتراضية للصلاة
function useDefaultPrayerTimes() {
    const now = new Date();
    const hour = now.getHours();
    
    // أوقات افتراضية (يمكن تعديلها)
    prayerTimes = {
        Fajr: '05:00',
        Sunrise: '06:30',
        Dhuhr: '12:30',
        Asr: '15:45',
        Maghrib: '18:00',
        Isha: '19:30',
        Imsak: '04:45',
        Midnight: '23:30'
    };
    
    updatePrayerTimesDisplay();
    calculateNextPrayer();
}

// تحديث عرض أوقات الصلاة
function updatePrayerTimesDisplay() {
    if (!prayerTimes) return;
    
    // تحديث كل وقت صلاة
    Object.keys(prayerTimeElements).forEach(prayer => {
        const prayerKey = prayer.charAt(0).toUpperCase() + prayer.slice(1);
        if (prayer === 'sunrise') {
            prayerTimeElements[prayer].textContent = formatTime(prayerTimes.Sunrise);
        } else {
            prayerTimeElements[prayer].textContent = formatTime(prayerTimes[prayerKey]);
        }
    });
    
    // إزالة النشاط من جميع البطاقات
    document.querySelectorAll('.prayer-card').forEach(card => {
        card.classList.remove('active', 'current');
    });
    
    // إضافة النشاط للصلاة الحالية إذا كانت موجودة
    if (currentPrayerCard) {
        currentPrayerCard.classList.add('active', 'current');
    }
}

// تنسيق الوقت
function formatTime(timeString) {
    if (!timeString) return '--:--';
    
    // تحويل الوقت من صيغة 24 ساعة إلى صيغة 12 ساعة مع AM/PM
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'م' : 'ص';
    const formattedHours = hours % 12 || 12;
    
    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// حساب الصلاة التالية
function calculateNextPrayer() {
    if (!prayerTimes) return;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const prayerTimesArray = [
        { name: 'fajr', time: convertTimeStringToMinutes(prayerTimes.Fajr) },
        { name: 'sunrise', time: convertTimeStringToMinutes(prayerTimes.Sunrise) },
        { name: 'dhuhr', time: convertTimeStringToMinutes(prayerTimes.Dhuhr) },
        { name: 'asr', time: convertTimeStringToMinutes(prayerTimes.Asr) },
        { name: 'maghrib', time: convertTimeStringToMinutes(prayerTimes.Maghrib) },
        { name: 'isha', time: convertTimeStringToMinutes(prayerTimes.Isha) }
    ];
    
    // البحث عن الصلاة التالية
    let nextPrayerObj = null;
    for (const prayer of prayerTimesArray) {
        if (prayer.time > currentTime) {
            nextPrayerObj = prayer;
            break;
        }
    }
    
    // إذا لم توجد صلاة تالية (أي أننا بعد العشاء)، نستخدم الفجر في اليوم التالي
    if (!nextPrayerObj) {
        nextPrayerObj = prayerTimesArray[0];
        nextPrayerObj.time += 24 * 60; // إضافة 24 ساعة
    }
    
    nextPrayer = nextPrayerObj;
    
    // تحديث عرض الصلاة التالية
    nextPrayerNameElement.textContent = prayerNames[nextPrayer.name];
    nextPrayerTimeElement.textContent = formatTime(prayerTimes[nextPrayer.name.charAt(0).toUpperCase() + nextPrayer.name.slice(1)]);
    
    // تحديث البطاقة النشطة
    document.querySelectorAll('.prayer-card').forEach(card => {
        card.classList.remove('current');
        if (card.dataset.prayer === nextPrayer.name) {
            card.classList.add('current');
            currentPrayerCard = card;
        }
    });
    
    // بدء العد التنازلي
    updateCountdown();
}

// تحويل نص الوقت إلى دقائق
function convertTimeStringToMinutes(timeString) {
    if (!timeString) return 0;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

// بدء العد التنازلي
function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
}

// تحديث العد التنازلي
function updateCountdown() {
    if (!nextPrayer) return;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds();
    
    let targetTime = nextPrayer.time * 60;
    
    // إذا كان وقت الصلاة التالية أقل من الوقت الحالي، أضف 24 ساعة
    if (targetTime <= currentTime) {
        targetTime += 24 * 60 * 60;
    }
    
    const timeDiff = targetTime - currentTime;
    
    if (timeDiff <= 0) {
        // إذا حان وقت الصلاة
        playAdhan();
        fetchPrayerTimes(); // تحديث أوقات الصلاة
        return;
    }
    
    const hours = Math.floor(timeDiff / 3600);
    const minutes = Math.floor((timeDiff % 3600) / 60);
    const seconds = timeDiff % 60;
    
    countdownElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // تحديث شريط التقدم في البطاقة النشطة
    updateProgressBar(timeDiff);
}

// تحديث شريط التقدم
function updateProgressBar(timeDiff) {
    if (!nextPrayer) return;
    
    const totalTime = 24 * 60 * 60; // 24 ساعة بالثواني
    const progress = ((totalTime - timeDiff) / totalTime) * 100;
    
    document.querySelectorAll('.prayer-card.current .prayer-status::after').forEach(bar => {
        bar.style.width = `${Math.min(progress, 100)}%`;
    });
}

// تشغيل الأذان
function playAdhan() {
    adhanAudio.currentTime = 0;
    adhanAudio.play().catch(error => {
        console.error('خطأ في تشغيل الأذان:', error);
        alert('تعذر تشغيل الأذان. يرجى التحقق من اتصال الإنترنت.');
    });
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    playAdhanButton.addEventListener('click', playAdhan);
    
    stopAdhanButton.addEventListener('click', () => {
        adhanAudio.pause();
        adhanAudio.currentTime = 0;
    });
    
    refreshLocationButton.addEventListener('click', async () => {
        cityElement.textContent = 'جاري تحديث الموقع...';
        const success = await getUserLocation();
        if (success) {
            await fetchPrayerTimes();
            startCountdown();
        }
    });
    
    calculationMethodSelect.addEventListener('change', async () => {
        if (userLocation) {
            await fetchPrayerTimes();
            startCountdown();
        }
    });
    
    // إضافة تأثيرات تفاعلية للبطاقات
    document.querySelectorAll('.prayer-card').forEach(card => {
        card.addEventListener('click', () => {
            const prayerName = card.dataset.prayer;
            alert(`وقت صلاة ${prayerNames[prayerName]} هو: ${card.querySelector('.prayer-time').textContent}`);
        });
    });
    
    // التحكم في مستوى صوت الأذان
    adhanAudio.addEventListener('volumechange', () => {
        console.log('مستوى الصوت:', adhanAudio.volume);
    });
    
    // إشعار عند انتهاء الأذان
    adhanAudio.addEventListener('ended', () => {
        console.log('انتهى تشغيل الأذان');
    });
}

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);

// إضافة دالة مساعدة للتحقق من وقت الصلاة الحالي
function checkCurrentPrayer() {
    if (!prayerTimes) return null;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const prayers = [
        { name: 'fajr', start: convertTimeStringToMinutes(prayerTimes.Fajr), end: convertTimeStringToMinutes(prayerTimes.Sunrise) },
        { name: 'dhuhr', start: convertTimeStringToMinutes(prayerTimes.Dhuhr), end: convertTimeStringToMinutes(prayerTimes.Asr) },
        { name: 'asr', start: convertTimeStringToMinutes(prayerTimes.Asr), end: convertTimeStringToMinutes(prayerTimes.Maghrib) },
        { name: 'maghrib', start: convertTimeStringToMinutes(prayerTimes.Maghrib), end: convertTimeStringToMinutes(prayerTimes.Isha) },
        { name: 'isha', start: convertTimeStringToMinutes(prayerTimes.Isha), end: convertTimeStringToMinutes(prayerTimes.Fajr) + 24 * 60 }
    ];
    
    for (const prayer of prayers) {
        if (currentTime >= prayer.start && currentTime < prayer.end) {
            return prayer.name;
        }
    }
    
    return null;
}

// تحديث البطاقة النشطة بناءً على الصلاة الحالية
function updateActivePrayerCard() {
    const currentPrayer = checkCurrentPrayer();
    
    document.querySelectorAll('.prayer-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.prayer === currentPrayer) {
            card.classList.add('active');
        }
    });
}

// تحديث كل 30 ثانية للتحقق من الصلاة الحالية
setInterval(updateActivePrayerCard, 30000);