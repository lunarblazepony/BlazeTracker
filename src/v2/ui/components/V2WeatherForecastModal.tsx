// ============================================
// V2 Weather Forecast Modal Component
// ============================================

import { createPortal } from 'react-dom';
import type { LocationForecast } from '../../../weather/types';
import { V2WeatherForecast } from './V2WeatherForecast';

export interface V2WeatherForecastModalProps {
	forecast: LocationForecast;
	currentHour: number;
	temperatureUnit: 'F' | 'C';
	timeFormat: '12h' | '24h';
	areaName?: string;
	onClose: () => void;
}

export function V2WeatherForecastModal({
	forecast,
	currentHour,
	temperatureUnit,
	timeFormat,
	areaName,
	onClose,
}: V2WeatherForecastModalProps) {
	return createPortal(
		<div className="bt-forecast-modal-overlay" onClick={onClose}>
			<div className="bt-forecast-modal" onClick={e => e.stopPropagation()}>
				<div className="bt-forecast-modal-header">
					<h3>
						<i className="fa-solid fa-cloud-sun"></i>
						{areaName
							? ` Weather - ${areaName}`
							: ' Weather Forecast'}
					</h3>
					<button className="menu_button" onClick={onClose}>
						<i className="fa-solid fa-xmark"></i>
					</button>
				</div>
				<div className="bt-forecast-modal-content">
					<V2WeatherForecast
						forecast={forecast}
						currentHour={currentHour}
						temperatureUnit={temperatureUnit}
						timeFormat={timeFormat}
					/>
				</div>
			</div>
		</div>,
		document.body,
	);
}
