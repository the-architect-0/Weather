// Configuration
const CONFIG = {
    API_KEY: 'a7f00e2eb74b6abcfc2f6d88a5329212', // Replace with your OpenWeatherMap API key
    API_BASE_URL: 'https://api.openweathermap.org/data/2.5/weather',
    DEFAULT_CITY: 'Benoni',
    UNITS: 'metric', // Default to Celsius
    TEMP_UNITS: {
        celsius: 'metric',
        fahrenheit: 'imperial'
    }
};

// DOM Elements
const elements = {
    cityInput: document.getElementById('city-input'),
    searchBtn: document.getElementById('search-btn'),
    currentLocationBtn: document.getElementById('current-location-btn'),
    errorContainer: document.getElementById('error-container'),
    loadingContainer: document.getElementById('loading-container'),
    weatherCard: document.getElementById('weather-card'),
    recentSearches: document.getElementById('recent-searches'),
    recentList: document.getElementById('recent-list'),
    
    // Weather data elements
    cityName: document.getElementById('city-name'),
    currentDatetime: document.getElementById('current-datetime'),
    temperature: document.getElementById('temperature'),
    weatherIcon: document.getElementById('weather-icon'),
    weatherDescription: document.getElementById('weather-description'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    feelsLike: document.getElementById('feels-like'),
    pressure: document.getElementById('pressure'),
    
    // Temperature toggle buttons
    tempUnits: document.querySelectorAll('.temp-unit')
};

// State
let state = {
    currentUnit: 'celsius',
    recentSearches: JSON.parse(localStorage.getItem('recentSearches')) || [],
    currentWeatherData: null
};

// Initialize the app
function init() {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Event Listeners
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.cityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    elements.currentLocationBtn.addEventListener('click', handleCurrentLocation);
    
    elements.tempUnits.forEach(btn => {
        btn.addEventListener('click', () => handleTempUnitChange(btn.dataset.unit));
    });
    
    // Load initial weather
    loadInitialWeather();
    
    // Update recent searches display
    updateRecentSearches();
}

// Load initial weather data
async function loadInitialWeather() {
    if (navigator.geolocation) {
        // Try to get current location
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                await fetchWeatherByCoords(latitude, longitude);
            },
            async (error) => {
                console.warn('Geolocation error:', error.message);
                // Fallback to default city
                await fetchWeatherByCity(CONFIG.DEFAULT_CITY);
            },
            { timeout: 10000 }
        );
    } else {
        // Geolocation not supported
        await fetchWeatherByCity(CONFIG.DEFAULT_CITY);
    }
}

// Handle search
async function handleSearch() {
    const city = elements.cityInput.value.trim();
    if (!city) {
        showError('Please enter a city name');
        return;
    }
    
    await fetchWeatherByCity(city);
}

// Handle current location
async function handleCurrentLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }
    
    showLoading();
    elements.weatherCard.style.display = 'none';
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await fetchWeatherByCoords(latitude, longitude);
        },
        (error) => {
            hideLoading();
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    showError('Location access denied. Please enable location services or search by city name.');
                    break;
                case error.POSITION_UNAVAILABLE:
                    showError('Location information unavailable. Please try again.');
                    break;
                case error.TIMEOUT:
                    showError('Location request timed out. Please try again.');
                    break;
                default:
                    showError('Failed to get location. Please try searching by city name.');
            }
        },
        { timeout: 10000 }
    );
}

// Handle temperature unit change
function handleTempUnitChange(unit) {
    if (state.currentUnit === unit) return;
    
    state.currentUnit = unit;
    
    // Update active button
    elements.tempUnits.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.unit === unit);
    });
    
    // Update display if we have weather data
    if (state.currentWeatherData) {
        updateWeatherDisplay(state.currentWeatherData);
    }
}

// Fetch weather by city name
async function fetchWeatherByCity(city) {
    showLoading();
    elements.weatherCard.style.display = 'none';
    hideError();
    
    try {
        const url = `${CONFIG.API_BASE_URL}?q=${encodeURIComponent(city)}&units=${CONFIG.TEMP_UNITS[state.currentUnit]}&appid=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add to recent searches
        addToRecentSearches(city);
        
        // Update state and display
        state.currentWeatherData = data;
        updateWeatherDisplay(data);
        
    } catch (error) {
        console.error('Error fetching weather:', error);
        
        if (error.message.includes('404')) {
            showError(`City "${city}" not found. Please check the spelling and try again.`);
        } else if (error.message.includes('401')) {
            showError('Invalid API key. Please check your configuration.');
        } else if (error.message.includes('429')) {
            showError('API rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('NetworkError')) {
            showError('Network error. Please check your internet connection.');
        } else {
            showError(`Failed to fetch weather data: ${error.message}`);
        }
    } finally {
        hideLoading();
    }
}

// Fetch weather by coordinates
async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    elements.weatherCard.style.display = 'none';
    hideError();
    
    try {
        const url = `${CONFIG.API_BASE_URL}?lat=${lat}&lon=${lon}&units=${CONFIG.TEMP_UNITS[state.currentUnit]}&appid=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add to recent searches
        addToRecentSearches(data.name);
        
        // Update state and display
        state.currentWeatherData = data;
        updateWeatherDisplay(data);
        
    } catch (error) {
        console.error('Error fetching weather:', error);
        showError('Failed to fetch weather data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Update weather display
function updateWeatherDisplay(data) {
    // Update basic info
    elements.cityName.textContent = `${data.name}, ${data.sys.country}`;
    elements.weatherDescription.textContent = data.weather[0].description;
    
    // Update temperature and feels like
    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const unitSymbol = state.currentUnit === 'celsius' ? '°C' : '°F';
    
    elements.temperature.textContent = `${temp}${unitSymbol}`;
    elements.feelsLike.textContent = `${feelsLike}${unitSymbol}`;
    
    // Update other details
    elements.humidity.textContent = `${data.main.humidity}%`;
    elements.windSpeed.textContent = `${data.wind.speed} ${state.currentUnit === 'celsius' ? 'm/s' : 'mph'}`;
    elements.pressure.textContent = `${data.main.pressure} hPa`;
    
    // Update weather icon
    updateWeatherIcon(data.weather[0].icon, data.weather[0].main);
    
    // Update date and time
    updateDateTime(data.timezone);
    
    // Show weather card
    elements.weatherCard.style.display = 'block';
    
    // Clear input
    elements.cityInput.value = '';
}

// Update weather icon based on condition
function updateWeatherIcon(iconCode, condition) {
    const iconMap = {
        '01d': 'fas fa-sun',           // clear sky day
        '01n': 'fas fa-moon',          // clear sky night
        '02d': 'fas fa-cloud-sun',     // few clouds day
        '02n': 'fas fa-cloud-moon',    // few clouds night
        '03d': 'fas fa-cloud',         // scattered clouds
        '03n': 'fas fa-cloud',
        '04d': 'fas fa-cloud',         // broken clouds
        '04n': 'fas fa-cloud',
        '09d': 'fas fa-cloud-rain',    // shower rain
        '09n': 'fas fa-cloud-rain',
        '10d': 'fas fa-cloud-sun-rain',// rain day
        '10n': 'fas fa-cloud-moon-rain',// rain night
        '11d': 'fas fa-bolt',          // thunderstorm
        '11n': 'fas fa-bolt',
        '13d': 'fas fa-snowflake',     // snow
        '13n': 'fas fa-snowflake',
        '50d': 'fas fa-smog',          // mist
        '50n': 'fas fa-smog'
    };
    
    // Use specific icon or fallback based on condition
    const iconClass = iconMap[iconCode] || getIconByCondition(condition);
    elements.weatherIcon.innerHTML = `<i class="${iconClass}"></i>`;
}

// Get icon by weather condition
function getIconByCondition(condition) {
    const conditionMap = {
        'Clear': 'fas fa-sun',
        'Clouds': 'fas fa-cloud',
        'Rain': 'fas fa-cloud-rain',
        'Drizzle': 'fas fa-cloud-rain',
        'Thunderstorm': 'fas fa-bolt',
        'Snow': 'fas fa-snowflake',
        'Mist': 'fas fa-smog',
        'Smoke': 'fas fa-smog',
        'Haze': 'fas fa-smog',
        'Dust': 'fas fa-smog',
        'Fog': 'fas fa-smog',
        'Sand': 'fas fa-smog',
        'Ash': 'fas fa-smog',
        'Squall': 'fas fa-wind',
        'Tornado': 'fas fa-wind'
    };
    
    return conditionMap[condition] || 'fas fa-question';
}

// Update date and time with timezone offset
function updateDateTime(timezoneOffset) {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localTime = new Date(utcTime + (timezoneOffset * 1000));
    
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    elements.currentDatetime.textContent = localTime.toLocaleDateString('en-US', options);
}

// Add city to recent searches
function addToRecentSearches(city) {
    // Remove if already exists
    state.recentSearches = state.recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase());
    
    // Add to beginning
    state.recentSearches.unshift(city);
    
    // Keep only last 5
    state.recentSearches = state.recentSearches.slice(0, 5);
    
    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));
    
    // Update display
    updateRecentSearches();
}

// Update recent searches display
function updateRecentSearches() {
    if (state.recentSearches.length === 0) {
        elements.recentSearches.style.display = 'none';
        return;
    }
    
    elements.recentSearches.style.display = 'block';
    elements.recentList.innerHTML = '';
    
    state.recentSearches.forEach(city => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.textContent = city;
        item.addEventListener('click', () => {
            elements.cityInput.value = city;
            handleSearch();
        });
        elements.recentList.appendChild(item);
    });
}

// Show loading spinner
function showLoading() {
    elements.loadingContainer.style.display = 'block';
}

// Hide loading spinner
function hideLoading() {
    elements.loadingContainer.style.display = 'none';
}

// Show error message
function showError(message) {
    elements.errorContainer.textContent = message;
    elements.errorContainer.style.display = 'block';
    
    // Auto-hide error after 5 seconds
    setTimeout(hideError, 5000);
}

// Hide error message
function hideError() {
    elements.errorContainer.style.display = 'none';
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);