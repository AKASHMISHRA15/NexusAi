import React, { useState, useEffect } from 'react';
import {
  Search, MapPin, Droplets, Wind, Eye, Gauge, Sun,
  CloudRain, Cloud, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Sunrise, Sunset, Loader2, RefreshCw, Shield, Navigation, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts';

// ── Helpers ──

const degToCompass = (deg: number): string => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
};

const uvLegend = [
  { range: '0-2', desc: 'Safe outside.', color: '#1DB954' },
  { range: '3-5', desc: 'Seek shade during midday.', color: '#efa044' },
  { range: '6-7', desc: 'Reduce time in sun.', color: '#ef8c44' },
  { range: '8-10', desc: 'Take extra precautions.', color: '#ef4444' },
  { range: '11+', desc: 'Avoid sun exposure.', color: '#d946ef' },
];

const uvLabel = (uv: number): { text: string; color: string } => {
  if (uv <= 2) return { text: 'Low', color: '#1DB954' };
  if (uv <= 5) return { text: 'Moderate', color: '#efa044' };
  if (uv <= 7) return { text: 'High', color: '#ef8c44' };
  if (uv <= 10) return { text: 'Very High', color: '#ef4444' };
  return { text: 'Extreme', color: '#d946ef' };
};

const aqiLegend = [
  { range: 'Good (0-50)', desc: 'Satisfactory.', color: '#1DB954' },
  { range: 'Moderate (51-100)', desc: 'Acceptable.', color: '#84cc16' },
  { range: 'Unhealthy (101-150)', desc: 'Sensitive groups.', color: '#efa044' },
  { range: 'Poor (151-200)', desc: 'Everyone affected.', color: '#ef8c44' },
  { range: 'Very Poor (201-300)', desc: 'Health alert.', color: '#ef4444' },
  { range: 'Severe (301-500)', desc: 'Emergency.', color: '#901a1e' }
];

const aqiLabel = (aqi: number): { text: string; color: string } => {
  if (aqi <= 50) return { text: 'Good', color: '#1DB954' };
  if (aqi <= 100) return { text: 'Moderate', color: '#84cc16' };
  if (aqi <= 150) return { text: 'Unhealthy', color: '#efa044' };
  if (aqi <= 200) return { text: 'Poor', color: '#ef8c44' };
  if (aqi <= 300) return { text: 'Very Poor', color: '#ef4444' };
  return { text: 'Severe', color: '#901a1e' };
};

const visLegend = [
  { range: '<1 km', desc: 'Poor: Dangerous driving.', color: '#ef4444' },
  { range: '1-5 km', desc: 'Moderate: Haze or light fog.', color: '#efa044' },
  { range: '5-10 km', desc: 'Good: Clear conditions.', color: '#84cc16' },
  { range: '>10 km', desc: 'Excellent: Perfectly clear.', color: '#1DB954' }
];

const humLegend = [
  { range: '<30%', desc: 'Dry: May cause skin irritation.', color: '#efa044' },
  { range: '30-60%', desc: 'Comfortable: Ideal conditions.', color: '#1DB954' },
  { range: '60-80%', desc: 'Humid: Feels muggy.', color: '#ef8c44' },
  { range: '>80%', desc: 'Very Humid: Uncomfortable.', color: '#ef4444' }
];

const mapWeatherCode = (code: number, isDay: boolean): { icon: string, desc: string } => {
  const d = isDay ? 'd' : 'n';
  if (code === 0) return { icon: `01${d}`, desc: 'Clear sky' };
  if (code === 1) return { icon: `02${d}`, desc: 'Mainly clear' };
  if (code === 2) return { icon: `03${d}`, desc: 'Partly cloudy' };
  if (code === 3) return { icon: `04${d}`, desc: 'Overcast' };
  if (code === 45 || code === 48) return { icon: `50${d}`, desc: 'Fog' };
  if (code >= 51 && code <= 55) return { icon: `09${d}`, desc: 'Drizzle' };
  if (code === 56 || code === 57) return { icon: `09${d}`, desc: 'Freezing Drizzle' };
  if (code >= 61 && code <= 65) return { icon: `10${d}`, desc: 'Rain' };
  if (code === 66 || code === 67) return { icon: `13${d}`, desc: 'Freezing Rain' };
  if (code >= 71 && code <= 77) return { icon: `13${d}`, desc: 'Snow fall' };
  if (code >= 80 && code <= 82) return { icon: `09${d}`, desc: 'Rain showers' };
  if (code === 85 || code === 86) return { icon: `13${d}`, desc: 'Snow showers' };
  if (code >= 95 && code <= 99) return { icon: `11${d}`, desc: 'Thunderstorm' };
  return { icon: `01${d}`, desc: 'Clear' };
};

const weatherIcon = (code: string) => {
  if (code.startsWith('01')) return <Sun size={56} color="#efa044" />;
  if (code.startsWith('02') || code.startsWith('03') || code.startsWith('04')) return <Cloud size={56} color="#94a3b8" />;
  if (code.startsWith('09')) return <CloudDrizzle size={56} color="#60a5fa" />;
  if (code.startsWith('10')) return <CloudRain size={56} color="#3b82f6" />;
  if (code.startsWith('11')) return <CloudLightning size={56} color="#fbbf24" />;
  if (code.startsWith('13')) return <CloudSnow size={56} color="#e2e8f0" />;
  if (code.startsWith('50')) return <CloudFog size={56} color="#94a3b8" />;
  return <Sun size={56} color="#efa044" />;
};

const bgGradient = (code: string, isNight: boolean): string => {
  if (isNight) return 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';
  if (code.startsWith('01')) return 'linear-gradient(135deg, #2c1810 0%, #4a2c17 30%, #1a1a2e 100%)';
  if (code.startsWith('09') || code.startsWith('10')) return 'linear-gradient(135deg, #0c1220 0%, #1a2a40 50%, #0f172a 100%)';
  if (code.startsWith('11')) return 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a1a2e 100%)';
  if (code.startsWith('13')) return 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)';
  return 'linear-gradient(135deg, #111827 0%, #1f2937 50%, #111827 100%)';
};

const formatTime = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

// ── Components ──

const CircularGauge: React.FC<{ value: number, max: number, label: string, color: string }> = ({ value, max, label, color }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.min(Math.max(value, 0), max);
  const strokeDashoffset = circumference - (safeValue / max) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0 16px' }}>
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none" />
        <circle cx="50" cy="50" r={radius} stroke={color} strokeWidth="10" fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} transform="rotate(-90 50 50)" />
        <text x="50" y="47" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="700">{value}</text>
        <text x="50" y="65" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" letterSpacing={1}>{label}</text>
      </svg>
    </div>
  );
};

// ── Types ──

interface WeatherData {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDeg: number;
  visibility: number;
  pressure: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
  lat: number;
  lon: number;
}

interface ForecastItem {
  dt: string;
  temp: number;
  icon: string;
  desc: string;
  pop: number; // precipitation probability
}

interface DailyForecast {
  dt: string;
  tempMin: number;
  tempMax: number;
  icon: string;
  desc: string;
  pop: number;
}

// ── Main Page ──

export const WeatherPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  
  const [allHourly, setAllHourly] = useState<ForecastItem[]>([]);
  const [hourly, setHourly] = useState<ForecastItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(''); // YYYY-MM-DD
  
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [uvIndex, setUvIndex] = useState<number | null>(null);
  const [aqi, setAqi] = useState<number | null>(null);
  
  const [histData, setHistData] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeModal, setActiveModal] = useState<{ type: 'aqi' | 'uv' | 'vis' | 'hum', val: number } | null>(null);

  // Fetch Historical Temperature Data (1, 5, 10 years ago)
  const fetchHistorical = async (lat: number, lon: number, currentTemp: number) => {
    setHistLoading(true);
    setHistData([]);
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      const getPastTemp = async (yearsAgo: number) => {
        const past = new Date(now);
        past.setFullYear(now.getFullYear() - yearsAgo);
        const ds = past.toISOString().split('T')[0];
        try {
          const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${ds}&end_date=${ds}&hourly=temperature_2m&timezone=auto`);
          if (res.ok) {
            const d = await res.json();
            return d.hourly?.temperature_2m?.[currentHour];
          }
        } catch {}
        return null;
      };

      const [t1, t5, t10] = await Promise.all([getPastTemp(1), getPastTemp(5), getPastTemp(10)]);
      
      setHistData([
        { name: '10 Yrs', temp: t10 ? Math.round(t10) : 0 },
        { name: '5 Yrs', temp: t5 ? Math.round(t5) : 0 },
        { name: '1 Yr', temp: t1 ? Math.round(t1) : 0 },
        { name: 'Current', temp: Math.round(currentTemp) },
      ]);
    } catch {}
    setHistLoading(false);
  };

  // Fetch weather by coords using Open-Meteo
  const fetchByCoords = async (lat: number, lon: number, cityName: string = 'Current Location', countryName: string = '') => {
    setLoading(true);
    setError('');
    setActiveModal(null);
    try {
      // Forecast & Current Data
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
      const d = await res.json();

      const isDay = d.current.is_day === 1;
      const wInfo = mapWeatherCode(d.current.weather_code, isDay);

      // Find current hour's visibility in hourly array
      const nowIdx = d.hourly.time.findIndex((t: string) => new Date(t).getTime() > Date.now()) || 0;
      const currentVis = (d.hourly.visibility[nowIdx] || 10000) / 1000;

      const currentTemp = Math.round(d.current.temperature_2m);
      
      setWeather({
        city: cityName,
        country: countryName,
        temp: currentTemp,
        feelsLike: Math.round(d.current.apparent_temperature),
        humidity: d.current.relative_humidity_2m,
        windSpeed: d.current.wind_speed_10m,
        windDeg: d.current.wind_direction_10m,
        visibility: currentVis,
        pressure: d.current.surface_pressure,
        description: wInfo.desc,
        icon: wInfo.icon,
        sunrise: d.daily.sunrise[0],
        sunset: d.daily.sunset[0],
        lat, lon,
      });

      setUvIndex(d.daily.uv_index_max[0]);

      // Save Full 7-Day Hourly Forecast
      const fullHourly: ForecastItem[] = [];
      for (let i = 0; i < d.hourly.time.length; i++) {
        const hIsDay = d.hourly.is_day[i] === 1;
        const hWInfo = mapWeatherCode(d.hourly.weather_code[i], hIsDay);
        fullHourly.push({
          dt: d.hourly.time[i],
          temp: Math.round(d.hourly.temperature_2m[i]),
          icon: hWInfo.icon,
          desc: hWInfo.desc,
          pop: d.hourly.precipitation_probability[i],
        });
      }
      setAllHourly(fullHourly);
      
      const todayStr = fullHourly[nowIdx].dt.split('T')[0];
      setSelectedDay(todayStr);

      // Daily Forecast
      const dItems: DailyForecast[] = [];
      for (let i = 0; i < 7 && i < d.daily.time.length; i++) {
        const dWInfo = mapWeatherCode(d.daily.weather_code[i], true); // assume day for daily
        let dailyPop = 0;
        const dayPrefix = d.daily.time[i];
        for (let j = 0; j < d.hourly.time.length; j++) {
           if (d.hourly.time[j].startsWith(dayPrefix)) {
               if (d.hourly.precipitation_probability[j] > dailyPop) {
                   dailyPop = d.hourly.precipitation_probability[j];
               }
           }
        }
        
        dItems.push({
          dt: d.daily.time[i],
          tempMin: Math.round(d.daily.temperature_2m_min[i]),
          tempMax: Math.round(d.daily.temperature_2m_max[i]),
          icon: dWInfo.icon,
          desc: dWInfo.desc,
          pop: dailyPop,
        });
      }
      setDaily(dItems);

      // Air Quality
      try {
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`;
        const aqRes = await fetch(aqUrl);
        if (aqRes.ok) {
          const aqData = await aqRes.json();
          setAqi(aqData.current.us_aqi);
        }
      } catch { setAqi(null); }

      // Fetch Historical Data
      fetchHistorical(lat, lon, currentTemp);

    } catch (e: any) {
      setError(e.message || 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  };

  // When selectedDay changes, update the hourly slice
  useEffect(() => {
    if (allHourly.length > 0 && selectedDay) {
      const dayData = allHourly.filter(h => h.dt.startsWith(selectedDay));
      const startIndex = dayData.findIndex(h => h.dt.includes('T06:00'));
      if (startIndex !== -1) {
        setHourly(dayData.slice(startIndex, startIndex + 12));
      } else {
        setHourly(dayData.slice(0, 12));
      }
    }
  }, [selectedDay, allHourly]);

  const fetchByCity = async (city: string) => {
    setLoading(true);
    setError('');
    try {
      const gRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'Vocalis-NexusAI/1.0' } }
      );
      const geo = await gRes.json();
      if (geo.length === 0) { setError('Location not found. Try a different search.'); setLoading(false); return; }
      
      const cityName = geo[0].display_name.split(',')[0];
      const parts = geo[0].display_name.split(',');
      const countryName = parts.length > 1 ? parts[parts.length - 1].trim() : '';

      await fetchByCoords(parseFloat(geo[0].lat), parseFloat(geo[0].lon), cityName, countryName);
    } catch (e: any) {
      setError(e.message || 'Search failed.');
      setLoading(false);
    }
  };

  const locateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
        () => fetchByCity('New Delhi'),
        { timeout: 6000 }
      );
    } else {
      fetchByCity('New Delhi');
    }
  };

  useEffect(() => {
    locateUser();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) fetchByCity(searchQuery.trim());
  };

  const isNight = weather ? weather.icon.endsWith('n') : false;
  const gradient = weather ? bgGradient(weather.icon, isNight) : 'linear-gradient(135deg, #111827, #1f2937)';

  const renderModal = () => {
    if (!activeModal) return null;
    let title = '';
    let max = 100;
    let label = '';
    let color = '';
    let legend: any[] = [];
    
    if (activeModal.type === 'aqi') {
      title = 'Air Quality Index Details';
      max = 500;
      label = 'US AQI';
      color = aqiLabel(activeModal.val).color;
      legend = aqiLegend;
    } else if (activeModal.type === 'uv') {
      title = 'UV Index Details';
      max = 11; // UV can go higher, but 11 is extreme
      label = 'UV';
      color = uvLabel(activeModal.val).color;
      legend = uvLegend;
    } else if (activeModal.type === 'vis') {
      title = 'Visibility Details';
      max = 20; // km
      label = 'KM';
      color = activeModal.val > 10 ? '#1DB954' : activeModal.val > 5 ? '#84cc16' : activeModal.val > 1 ? '#efa044' : '#ef4444';
      legend = visLegend;
    } else if (activeModal.type === 'hum') {
      title = 'Humidity Details';
      max = 100;
      label = '%';
      color = activeModal.val > 80 ? '#ef4444' : activeModal.val > 60 ? '#ef8c44' : activeModal.val > 30 ? '#1DB954' : '#efa044';
      legend = humLegend;
    }

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setActiveModal(null)}>
        <div style={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '24px', width: '320px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
            <button onClick={() => setActiveModal(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', borderRadius: '50%', padding: 4, cursor: 'pointer', display: 'flex' }}><X size={16}/></button>
          </div>
          
          <CircularGauge value={Number(activeModal.val.toFixed(1))} max={max} label={label} color={color} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {legend.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: l.color }} />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ fontWeight: 700, color: l.color }}>{l.range}</span>: {l.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="workspace-page" style={{ padding: 0, overflow: 'auto' }}>
      {renderModal()}
      
      <div style={{ minHeight: '100%', background: gradient, padding: '28px', transition: 'background 0.8s ease', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Header + Search */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <p className="eyebrow" style={{ opacity: 0.6 }}>WEATHER</p>
            <h1 style={{ margin: '4px 0 6px', fontSize: 28, fontWeight: 700 }}>
              {weather ? `${weather.city}${weather.country ? `, ${weather.country}` : ''}` : 'Weather Dashboard'}
            </h1>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Live weather data powered by Open-Meteo</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={locateUser} disabled={loading} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, padding: '0 16px', fontWeight: 600, fontSize: 13, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, height: 38 }}>
               <Navigation size={14} color="#5B8CFF" />
               Current Location
            </button>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, minWidth: 300, height: 38 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)' }} />
                <input
                  type="text" placeholder="Search city or location..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px 10px 36px', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <button type="submit" disabled={loading}
                style={{ background: '#5B8CFF', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={14} />}
                Search
              </button>
            </form>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', color: '#ff6b6b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {weather && !loading && (
          <>
            {/* ── Main Weather Card ── */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {/* Left: big temp */}
              <div style={{ flex: '1 1 340px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 32px', display: 'flex', alignItems: 'center', gap: 28, minWidth: 0 }}>
                <div>
                  {weatherIcon(weather.icon)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <MapPin size={14} color="rgba(255,255,255,0.5)" />
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{weather.city}{weather.country ? `, ${weather.country}` : ''}</span>
                    <button onClick={() => weather && fetchByCoords(weather.lat, weather.lon, weather.city, weather.country)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4, display: 'flex' }} title="Refresh">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                  <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>
                    {weather.temp}°<span style={{ fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>C</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>
                    {weather.description}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Feels like {weather.feelsLike}°C
                  </div>
                </div>
              </div>

              {/* Right: parameter grid */}
              <div style={{ flex: '1 1 380px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, minWidth: 0 }}>
                <StatCard icon={<Droplets size={18} color="#60a5fa" />} label="Humidity" value={`${weather.humidity}%`} onClick={() => setActiveModal({ type: 'hum', val: weather.humidity })} />
                <StatCard icon={<Wind size={18} color="#34d399" />} label="Wind" value={`${weather.windSpeed} km/h`} sub={degToCompass(weather.windDeg)} />
                <StatCard icon={<Eye size={18} color="#a78bfa" />} label="Visibility" value={`${weather.visibility.toFixed(1)} km`} onClick={() => setActiveModal({ type: 'vis', val: weather.visibility })} />
                <StatCard icon={<Gauge size={18} color="#f59e0b" />} label="Pressure" value={`${weather.pressure} hPa`} />
                <StatCard
                  icon={<Sun size={18} color={uvIndex !== null ? uvLabel(uvIndex).color : '#94a3b8'} />}
                  label="UV Index"
                  value={uvIndex !== null ? uvIndex.toFixed(1) : '—'}
                  sub={uvIndex !== null ? uvLabel(uvIndex).text : ''}
                  subColor={uvIndex !== null ? uvLabel(uvIndex).color : undefined}
                  onClick={() => uvIndex !== null && setActiveModal({ type: 'uv', val: uvIndex })}
                />
                <StatCard
                  icon={<Shield size={18} color={aqi !== null ? aqiLabel(aqi).color : '#94a3b8'} />}
                  label="Air Quality"
                  value={aqi !== null ? `AQI ${aqi}` : '—'}
                  sub={aqi !== null ? aqiLabel(aqi).text : ''}
                  subColor={aqi !== null ? aqiLabel(aqi).color : undefined}
                  onClick={() => aqi !== null && setActiveModal({ type: 'aqi', val: aqi })}
                />
              </div>
            </div>

            {/* ── Sunrise / Sunset ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Sunrise size={20} color="#f59e0b" />
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Sunrise</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{formatTime(weather.sunrise)}</div>
                </div>
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Sunset size={20} color="#ef8c44" />
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Sunset</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{formatTime(weather.sunset)}</div>
                </div>
              </div>
            </div>

            {/* ── 7-Day Forecast ── */}
            {daily.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  7-Day Forecast <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>(Click a day to view its hourly breakdown)</span>
                </h3>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  {daily.map((d, i) => {
                    const dayName = i === 0 ? 'Today' : new Date(d.dt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                    const isSelected = selectedDay === d.dt;
                    return (
                      <div key={i} 
                           onClick={() => setSelectedDay(d.dt)}
                           style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < daily.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', cursor: 'pointer', background: isSelected ? 'rgba(91,140,255,0.1)' : 'transparent', transition: 'background 0.2s' }}>
                        <div style={{ width: 100, fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#5B8CFF' : '#fff' }}>{dayName}</div>
                        <div style={{ width: 36 }}>{weatherIcon(d.icon)}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{d.desc}</div>
                        {d.pop > 0 && (
                          <div style={{ fontSize: 11, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 3, width: 50 }}>
                            <Droplets size={10} /> {d.pop}%
                          </div>
                        )}
                        <div style={{ width: 80, textAlign: 'right', fontSize: 14 }}>
                          <span style={{ fontWeight: 700 }}>{d.tempMax}°</span>
                          <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>{d.tempMin}°</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Hourly Forecast ── */}
            {hourly.length > 0 && (
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  Hourly Forecast for {new Date(selectedDay).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                  {hourly.map((h, i) => (
                    <div key={i} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', minWidth: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                        {formatTime(h.dt)}
                      </div>
                      {weatherIcon(h.icon)}
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{h.temp}°</div>
                      {h.pop > 0 && (
                        <div style={{ fontSize: 10, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Droplets size={10} /> {h.pop}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Historical Comparison ── */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Historical Temperature Context</h3>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px', height: 280, display: 'flex', flexDirection: 'column' }}>
                {histLoading ? (
                   <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                     <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Fetching climate archives...
                   </div>
                ) : histData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={histData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}°`} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1a1d24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                      <Bar dataKey="temp" radius={[6, 6, 0, 0]}>
                        {histData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Current' ? '#5B8CFF' : 'rgba(255,255,255,0.15)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                     Historical data unavailable for this location.
                  </div>
                )}
              </div>
            </div>

          </>
        )}

        {loading && !weather && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.4)', fontSize: 14, minHeight: 300 }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading weather data...
          </div>
        )}
      </div>
    </section>
  );
};

// ── Stat Card ──
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; subColor?: string; onClick?: () => void }> = ({ icon, label, value, sub, subColor, onClick }) => (
  <div onClick={onClick} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, cursor: onClick ? 'pointer' : 'default', transition: 'background 0.2s', ...(onClick ? { ':hover': { background: 'rgba(255,255,255,0.08)' } } as any : {}) }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
    </div>
    <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: subColor || 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{sub}</div>}
  </div>
);
