/**
 * V2 Climate Display Component
 *
 * Shows climate information with tooltip on hover.
 * Works with v2 ClimateForecast type directly.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type {
	ClimateForecast,
	DaylightPhase,
	BuildingType,
	WeatherCondition,
} from '../../types/common';

export interface V2ClimateDisplayProps {
	climate: ClimateForecast;
	temperatureUnit?: 'F' | 'C';
}

interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
}

// Icon mappings
const CONDITION_ICONS: Record<WeatherCondition, string> = {
	clear: 'fa-moon',
	sunny: 'fa-sun',
	partly_cloudy: 'fa-cloud-sun',
	overcast: 'fa-cloud',
	foggy: 'fa-smog',
	drizzle: 'fa-cloud-rain',
	rain: 'fa-cloud-showers-heavy',
	heavy_rain: 'fa-cloud-showers-water',
	thunderstorm: 'fa-cloud-bolt',
	sleet: 'fa-cloud-meatball',
	snow: 'fa-snowflake',
	heavy_snow: 'fa-snowflake',
	blizzard: 'fa-icicles',
	windy: 'fa-wind',
	hot: 'fa-temperature-high',
	cold: 'fa-temperature-low',
	humid: 'fa-droplet',
};

const DAYLIGHT_ICONS: Record<DaylightPhase, string> = {
	dawn: 'fa-sun-haze',
	day: 'fa-sun',
	dusk: 'fa-sunset',
	night: 'fa-moon',
};

const DAYLIGHT_LABELS: Record<DaylightPhase, string> = {
	dawn: 'Dawn',
	day: 'Daytime',
	dusk: 'Dusk',
	night: 'Nighttime',
};

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
	modern: 'Climate controlled',
	heated: 'Heated building',
	unheated: 'Unheated structure',
	underground: 'Underground',
	tent: 'Tent/minimal shelter',
	vehicle: 'Vehicle',
};

// Helpers
function formatTemperature(temp: number, unit: 'F' | 'C'): string {
	if (unit === 'C') {
		const celsius = ((temp - 32) * 5) / 9;
		return `${Math.round(celsius)}°C`;
	}
	return `${Math.round(temp)}°F`;
}

function getWindDescription(speed: number): string {
	if (speed < 1) return 'Calm';
	if (speed < 8) return 'Light breeze';
	if (speed < 13) return 'Gentle breeze';
	if (speed < 19) return 'Moderate breeze';
	if (speed < 25) return 'Fresh breeze';
	if (speed < 32) return 'Strong breeze';
	if (speed < 39) return 'High wind';
	if (speed < 47) return 'Gale';
	if (speed < 55) return 'Strong gale';
	return 'Storm force';
}

function getHumidityDescription(humidity: number): string {
	if (humidity < 30) return 'Very dry';
	if (humidity < 45) return 'Dry';
	if (humidity < 65) return 'Comfortable';
	if (humidity < 80) return 'Humid';
	return 'Very humid';
}

function getUVDescription(uv: number): string {
	if (uv < 3) return 'Low';
	if (uv < 6) return 'Moderate';
	if (uv < 8) return 'High';
	if (uv < 11) return 'Very high';
	return 'Extreme';
}

export function V2ClimateDisplay({ climate, temperatureUnit = 'F' }: V2ClimateDisplayProps) {
	const [tooltip, setTooltip] = useState<TooltipState>({
		visible: false,
		x: 0,
		y: 0,
	});

	const conditionIcon = CONDITION_ICONS[climate.conditionType] ?? 'fa-question';
	const displayTemp = climate.temperature;
	const isIndoors = climate.isIndoors;

	const feelsLikeDiff = Math.abs(climate.feelsLike - climate.outdoorTemperature);
	const showFeelsLike = !isIndoors && feelsLikeDiff > 5;

	const handleMouseEnter = (e: React.MouseEvent) => {
		setTooltip({
			visible: true,
			x: e.clientX,
			y: e.clientY - 10,
		});
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		setTooltip(prev => ({
			...prev,
			x: e.clientX,
			y: e.clientY - 10,
		}));
	};

	const handleMouseLeave = () => {
		setTooltip(prev => ({ ...prev, visible: false }));
	};

	return (
		<>
			<span
				className="bt-climate"
				onMouseEnter={handleMouseEnter}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				<i className={`fa-solid ${conditionIcon}`}></i>
				<span className="bt-climate-temp">
					{formatTemperature(displayTemp, temperatureUnit)}
				</span>
				{isIndoors && (
					<i
						className="fa-solid fa-house bt-climate-indoor"
						title="Indoors"
					></i>
				)}
				{showFeelsLike && (
					<span className="bt-climate-feels">
						<i className="fa-solid fa-temperature-half"></i>
						<span className="bt-feels-value">
							{formatTemperature(
								climate.feelsLike,
								temperatureUnit,
							)}
						</span>
					</span>
				)}
				{climate.windSpeed >= 15 && !isIndoors && (
					<i
						className="fa-solid fa-wind bt-climate-wind"
						title={`${Math.round(climate.windSpeed)} mph ${climate.windDirection}`}
					></i>
				)}
				{climate.humidity >= 75 && !isIndoors && (
					<i
						className="fa-solid fa-droplet bt-climate-humidity"
						title={`${Math.round(climate.humidity)}% humidity`}
					></i>
				)}
			</span>

			{tooltip.visible &&
				createPortal(
					<div
						className="bt-climate-tooltip"
						style={{
							position: 'fixed',
							left: tooltip.x,
							top: tooltip.y,
							transform: 'translate(-50%, -100%)',
						}}
					>
						<div className="bt-climate-tooltip-row bt-climate-conditions">
							<i
								className={`fa-solid ${conditionIcon}`}
							></i>
							<span>{climate.conditions}</span>
						</div>
						<div className="bt-climate-tooltip-row">
							<i
								className={`fa-solid ${DAYLIGHT_ICONS[climate.daylight]}`}
							></i>
							<span>
								{DAYLIGHT_LABELS[climate.daylight]}
							</span>
						</div>
						<div className="bt-climate-tooltip-section">
							{isIndoors &&
								climate.indoorTemperature !==
									undefined && (
									<div className="bt-climate-tooltip-row">
										<i className="fa-solid fa-house"></i>
										<span>
											Indoor:{' '}
											{formatTemperature(
												climate.indoorTemperature,
												temperatureUnit,
											)}
											{climate.buildingType && (
												<span className="bt-climate-building">
													{' '}
													(
													{
														BUILDING_TYPE_LABELS[
															climate
																.buildingType
														]
													}

													)
												</span>
											)}
										</span>
									</div>
								)}
							<div className="bt-climate-tooltip-row">
								<i className="fa-solid fa-tree"></i>
								<span>
									Outdoor:{' '}
									{formatTemperature(
										climate.outdoorTemperature,
										temperatureUnit,
									)}
								</span>
							</div>
							{feelsLikeDiff > 2 && (
								<div className="bt-climate-tooltip-row">
									<i className="fa-solid fa-temperature-half"></i>
									<span>
										Feels like:{' '}
										{formatTemperature(
											climate.feelsLike,
											temperatureUnit,
										)}
									</span>
								</div>
							)}
						</div>
						<div className="bt-climate-tooltip-section">
							<div className="bt-climate-tooltip-row">
								<i className="fa-solid fa-droplet"></i>
								<span>
									{Math.round(
										climate.humidity,
									)}
									% humidity (
									{getHumidityDescription(
										climate.humidity,
									)}
									)
								</span>
							</div>
							<div className="bt-climate-tooltip-row">
								<i className="fa-solid fa-wind"></i>
								<span>
									{getWindDescription(
										climate.windSpeed,
									)}
									{climate.windSpeed >= 5 && (
										<>
											{' '}
											(
											{Math.round(
												climate.windSpeed,
											)}{' '}
											mph{' '}
											{
												climate.windDirection
											}
											)
										</>
									)}
								</span>
							</div>
							{climate.daylight === 'day' &&
								climate.uvIndex > 0 && (
									<div className="bt-climate-tooltip-row">
										<i className="fa-solid fa-sun"></i>
										<span>
											UV Index:{' '}
											{
												climate.uvIndex
											}{' '}
											(
											{getUVDescription(
												climate.uvIndex,
											)}
											)
										</span>
									</div>
								)}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
