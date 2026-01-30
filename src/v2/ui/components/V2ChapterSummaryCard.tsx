/**
 * V2 Chapter Summary Card Component
 *
 * Displays a summary of the previous chapter when a new chapter starts.
 * Styled like a narrative event with chapter-specific indicators:
 * - Blue book icon instead of tension icons
 * - Chapter name + time range instead of just time
 * - Characters involved instead of witnesses
 */

import type { ComputedChapter } from '../../narrative/computeChapters';

export interface V2ChapterSummaryCardProps {
	chapter: ComputedChapter;
	/** Callback when "Read full summary" is clicked, passes chapter index */
	onViewDetails?: (chapterIndex: number) => void;
	timeFormat?: '12h' | '24h';
}

/**
 * Format time for display based on format preference.
 */
function formatTime(time: moment.Moment | null, timeFormat: '12h' | '24h'): string {
	if (!time) return '';
	if (timeFormat === '24h') {
		return time.format('ddd HH:mm');
	}
	const hour12 = time.hour() % 12 || 12;
	const ampm = time.hour() < 12 ? 'AM' : 'PM';
	const minute = time.minute().toString().padStart(2, '0');
	return `${time.format('ddd')} ${hour12}:${minute} ${ampm}`;
}

/**
 * Get time range from chapter start/end times (computed from projections).
 */
function getTimeRange(chapter: ComputedChapter, timeFormat: '12h' | '24h'): string {
	if (!chapter.startTime && !chapter.endTime) return '';

	const start = chapter.startTime ? formatTime(chapter.startTime, timeFormat) : '';
	const end = chapter.endTime ? formatTime(chapter.endTime, timeFormat) : '';

	if (!start) return end;
	if (!end || start === end) return start;

	return `${start} - ${end}`;
}

/**
 * Get all characters involved in the chapter from narrative events.
 * Extracts from subject pairs and witnesses.
 */
function getChapterCharacters(chapter: ComputedChapter): string[] {
	const characters = new Set<string>();

	for (const event of chapter.narrativeEvents) {
		// Add characters from subject pairs
		for (const subject of event.subjects) {
			characters.add(subject.pair[0]);
			characters.add(subject.pair[1]);
		}
		// Add witnesses
		for (const witness of event.witnesses) {
			characters.add(witness);
		}
	}

	return Array.from(characters).sort();
}

export function V2ChapterSummaryCard({
	chapter,
	onViewDetails,
	timeFormat = '12h',
}: V2ChapterSummaryCardProps) {
	// Get first paragraph of summary
	const firstParagraph = chapter.summary
		? chapter.summary.split('\n\n')[0]
		: 'No summary available';

	const hasMoreContent = chapter.summary && chapter.summary.includes('\n\n');
	const timeRange = getTimeRange(chapter, timeFormat);
	const characters = getChapterCharacters(chapter);

	return (
		<div
			className="bt-event-item bt-chapter-summary-item"
			style={{ borderLeftColor: '#5b8dd9' }}
		>
			{/* Row 1: Chapter name + time range (left), Book icon (right) */}
			<div className="bt-event-header">
				<span className="bt-event-time">
					<strong>
						Ch. {chapter.index + 1}: {chapter.title}
					</strong>
					{timeRange && (
						<span className="bt-chapter-time-range">
							{' '}
							({timeRange})
						</span>
					)}
				</span>
				<div className="bt-event-header-right">
					<div className="bt-event-tension">
						<i
							className="fa-solid fa-book-bookmark"
							style={{ color: '#5b8dd9' }}
							title="Previous chapter"
						/>
					</div>
				</div>
			</div>

			{/* Row 2: Summary (first paragraph) */}
			<div className="bt-event-summary">{firstParagraph}</div>

			{/* Row 3: Characters involved */}
			{characters.length > 0 && (
				<div className="bt-event-footer">
					<div className="bt-event-people">
						<div className="bt-event-witnesses">
							<span className="bt-witnesses-label">
								Characters:
							</span>
							{characters.map((char, i) => (
								<span
									key={i}
									className="bt-witness"
								>
									{char}
								</span>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Read more link */}
			{hasMoreContent && onViewDetails && (
				<div className="bt-chapter-summary-read-more">
					<button
						className="bt-v2-chapter-read-more"
						onClick={() => onViewDetails(chapter.index)}
					>
						Read full summary
						<i className="fa-solid fa-arrow-right"></i>
					</button>
				</div>
			)}
		</div>
	);
}
