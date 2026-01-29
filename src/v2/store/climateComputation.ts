/**
 * Climate Computation
 *
 * Computes climate (ClimateForecast) deterministically from:
 * - Forecasts (28-day weather data per area)
 * - Time (current narrative datetime)
 * - Location (current area, place, position)
 *
 * Climate is a derived/computed value, not stored as events.
 */

import type { Moment } from 'moment';
import type { LocationForecast, HourlyWeather, DailyForecast } from '../../weather/types';
import type { ClimateForecast, LocationState } from '../types/common';
import {
	deriveCondition,
	describeCondition,
	getWindDirection,
	getDaylightPhase,
	calculateFeelsLike,
} from '../../weather/weatherDeriver';
import { calculateEffectiveTemperature } from '../../weather/indoorTemperature';

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(m: Moment): string {
	return m.format('YYYY-MM-DD');
}

/**
 * Look up the hourly weather for a specific time in a forecast.
 */
function lookupWeatherAtTime(
	forecast: LocationForecast,
	time: Moment,
): { hourly: HourlyWeather; daily: DailyForecast } | null {
	const dateStr = formatDate(time);
	const day = forecast.days.find(d => d.date === dateStr);
	if (!day) return null;

	const hour = Math.max(0, Math.min(23, time.hour()));
	const hourly = day.hourly[hour];
	if (!hourly) return null;

	return { hourly, daily: day };
}

/**
 * Get the number of days remaining in a forecast from the given time.
 * Returns 0 if time is outside forecast range or before start.
 */
export function getDaysRemainingInForecast(forecast: LocationForecast, time: Moment): number {
	const startDate = forecast.startDate;
	const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
	const start = new Date(startYear, startMonth - 1, startDay);
	const current = time.toDate();

	const diffTime = current.getTime() - start.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

	// If before start or beyond end, return 0
	if (diffDays < 0 || diffDays >= forecast.days.length) {
		return 0;
	}

	// Days remaining = total days - current day index
	return forecast.days.length - diffDays;
}

/**
 * Check if the time is within the forecast range.
 * Forecasts are 28 days from their start date.
 */
export function isTimeWithinForecast(forecast: LocationForecast, time: Moment): boolean {
	return getDaysRemainingInForecast(forecast, time) > 0;
}

/**
 * Compute climate from forecasts, time, and location.
 *
 * Returns null if:
 * - No time available
 * - No location area
 * - No forecast for the current area
 * - Time is outside the forecast range
 */
export function computeClimate(
	forecasts: Record<string, LocationForecast>,
	time: Moment | null,
	location: LocationState | null,
): ClimateForecast | null {
	if (!time || !location?.area) {
		return null;
	}

	const forecast = forecasts[location.area];
	if (!forecast) {
		return null;
	}

	const weather = lookupWeatherAtTime(forecast, time);
	if (!weather) {
		return null;
	}

	const { hourly, daily } = weather;

	// Calculate indoor/outdoor temperature
	const tempResult = calculateEffectiveTemperature(hourly.temperature, location, time.hour());

	// Derive condition
	const conditionType = deriveCondition(hourly);
	const conditions = describeCondition(conditionType);

	// Build the climate forecast
	const climate: ClimateForecast = {
		temperature: Math.round(tempResult.effectiveTemperature),
		outdoorTemperature: hourly.temperature,
		indoorTemperature: tempResult.indoorTemperature,
		feelsLike: calculateFeelsLike(
			hourly.temperature,
			hourly.humidity,
			hourly.windSpeed,
		),
		humidity: hourly.humidity,
		precipitation: hourly.precipitation,
		cloudCover: hourly.cloudCover,
		windSpeed: hourly.windSpeed,
		windDirection: getWindDirection(hourly.windDirection),
		conditions,
		conditionType,
		uvIndex: hourly.uvIndex,
		daylight: getDaylightPhase(time.hour(), daily.sunrise, daily.sunset),
		isIndoors: tempResult.isIndoors,
		buildingType: tempResult.buildingType,
	};

	return climate;
}

/** Minimum days of forecast we want to maintain for the modal (current + 7) */
export const MIN_FORECAST_DAYS = 8;

/**
 * Check if a new forecast needs to be generated for the given area and time.
 *
 * Returns true if:
 * - No forecast exists for the area
 * - Time is before the forecast start (shouldn't happen normally)
 * - Less than 8 days remaining in forecast (need 8 days for modal display)
 */
export function needsNewForecast(
	forecasts: Record<string, LocationForecast>,
	areaName: string,
	time: Moment,
): boolean {
	const forecast = forecasts[areaName];
	if (!forecast) {
		return true;
	}

	const daysRemaining = getDaysRemainingInForecast(forecast, time);
	return daysRemaining < MIN_FORECAST_DAYS;
}
