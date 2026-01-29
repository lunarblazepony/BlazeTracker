// ============================================
// V2 Weather Forecast Display Component
// ============================================

import { useRef, useEffect } from 'react';
import type {
	LocationForecast,
	DailyForecast,
	WeatherCondition,
	HourlyWeather,
} from '../../../weather/types';
import { getConditionIconDayNight } from '../icons';
import { formatTemperature } from '../../../utils/temperatures';
import { formatDecimalHour, getDayAbbreviation, formatHour } from '../../../utils/dateFormat';

// ============================================
// Types
// ============================================

export interface V2WeatherForecastProps {
	forecast: LocationForecast;
	currentHour: number; // 0-23
	temperatureUnit?: 'F' | 'C';
	timeFormat?: '12h' | '24h';
}

// ============================================
// Sub-components
// ============================================

interface HourlySlotProps {
	hour: number;
	temperature: number;
	condition: WeatherCondition;
	precipProbability: number;
	isNow: boolean;
	isNight: boolean;
	temperatureUnit: 'F' | 'C';
	timeFormat: '12h' | '24h';
}

function HourlySlot({
	hour,
	temperature,
	condition,
	precipProbability,
	isNow,
	isNight,
	temperatureUnit,
	timeFormat,
}: HourlySlotProps) {
	const icon = getConditionIconDayNight(condition, isNight);
	const tempUnit = temperatureUnit === 'C' ? 'celsius' : 'fahrenheit';
	const tempDisplay = formatTemperature(temperature, tempUnit);
	const timeLabel = isNow ? 'Now' : formatHour(hour, timeFormat);

	return (
		<div className={`bt-forecast-hour ${isNow ? 'bt-forecast-now' : ''}`}>
			<span className="bt-forecast-hour-time">{timeLabel}</span>
			<i className={`fa-solid ${icon}`}></i>
			<span className="bt-forecast-hour-temp">{tempDisplay}</span>
			{precipProbability > 10 && (
				<span className="bt-forecast-hour-precip">
					<i className="fa-solid fa-droplet"></i>
					{Math.round(precipProbability)}%
				</span>
			)}
		</div>
	);
}

interface DailySlotProps {
	day: DailyForecast;
	temperatureUnit: 'F' | 'C';
}

function DailySlot({ day, temperatureUnit }: DailySlotProps) {
	const dayAbbr = getDayAbbreviation(day.date);
	const icon = getConditionIconDayNight(day.dominantCondition, false);
	const tempUnit = temperatureUnit === 'C' ? 'celsius' : 'fahrenheit';
	const highDisplay = formatTemperature(day.high, tempUnit);
	const lowDisplay = formatTemperature(day.low, tempUnit);

	// Calculate average precip probability for the day
	const avgPrecip =
		day.hourly.reduce((sum: number, h: HourlyWeather) => sum + h.precipProbability, 0) /
		day.hourly.length;

	return (
		<div className="bt-forecast-day">
			<span className="bt-forecast-day-name">{dayAbbr}</span>
			<i className={`fa-solid ${icon}`}></i>
			<span className="bt-forecast-day-high">{highDisplay}</span>
			<span className="bt-forecast-day-low">{lowDisplay}</span>
			{avgPrecip > 10 && (
				<span className="bt-forecast-day-precip">
					{Math.round(avgPrecip)}%
				</span>
			)}
		</div>
	);
}

// ============================================
// Main Component
// ============================================

export function V2WeatherForecast({
	forecast,
	currentHour,
	temperatureUnit = 'F',
	timeFormat = '12h',
}: V2WeatherForecastProps) {
	const hourlyScrollRef = useRef<HTMLDivElement>(null);

	// Scroll to "Now" on mount - must be before any early returns
	useEffect(() => {
		if (hourlyScrollRef.current) {
			hourlyScrollRef.current.scrollLeft = 0;
		}
	}, []);

	// Get today's forecast (first day)
	const today = forecast.days[0];
	if (!today) {
		return null;
	}

	// Get remaining hours of today starting from current hour
	const remainingHours = today.hourly.filter((h: HourlyWeather) => h.hour >= currentHour);

	// If less than 8 hours remain today, add hours from tomorrow
	const tomorrow = forecast.days[1];
	let hourlyForecast = [...remainingHours];
	if (tomorrow && hourlyForecast.length < 12) {
		const hoursNeeded = 12 - hourlyForecast.length;
		hourlyForecast = [...hourlyForecast, ...tomorrow.hourly.slice(0, hoursNeeded)];
	}

	// Get 7-day forecast
	const weekForecast = forecast.days.slice(0, 7);

	// Determine if an hour is nighttime
	const isNightHour = (hour: number, dayForecast: DailyForecast): boolean => {
		return hour < dayForecast.sunrise || hour >= dayForecast.sunset;
	};

	return (
		<div className="bt-forecast">
			{/* Today's Header */}
			<div className="bt-forecast-header">
				<span className="bt-forecast-title">TODAY</span>
				<span className="bt-forecast-sun">
					<i className="fa-solid fa-sun"></i>
					{formatDecimalHour(today.sunrise, timeFormat)}
					<i className="fa-solid fa-moon"></i>
					{formatDecimalHour(today.sunset, timeFormat)}
				</span>
			</div>

			{/* Hourly Forecast (scrollable) */}
			<div className="bt-forecast-hourly" ref={hourlyScrollRef}>
				{hourlyForecast.map((hourData, idx) => {
					// Determine which day this hour belongs to
					const isFromTomorrow = idx >= remainingHours.length;
					const dayData = isFromTomorrow ? tomorrow! : today;

					return (
						<HourlySlot
							key={`${dayData.date}-${hourData.hour}`}
							hour={hourData.hour}
							temperature={hourData.temperature}
							condition={dayData.dominantCondition}
							precipProbability={
								hourData.precipProbability
							}
							isNow={idx === 0}
							isNight={isNightHour(
								hourData.hour,
								dayData,
							)}
							temperatureUnit={temperatureUnit}
							timeFormat={timeFormat}
						/>
					);
				})}
			</div>

			{/* 7-Day Forecast Header */}
			<div className="bt-forecast-header bt-forecast-week-header">
				<span className="bt-forecast-title">7-DAY FORECAST</span>
			</div>

			{/* 7-Day Forecast */}
			<div className="bt-forecast-weekly">
				{weekForecast.map((day: DailyForecast) => (
					<DailySlot
						key={day.date}
						day={day}
						temperatureUnit={temperatureUnit}
					/>
				))}
			</div>
		</div>
	);
}
