import { ActiveElement, Chart, ChartData, ChartEvent } from 'chart.js';
import Graph from 'components/Graph';
import { METRICS_PAGE_QUERY_PARAM } from 'constants/query';
import ROUTES from 'constants/routes';
import FullView from 'container/GridGraphLayout/Graph/FullView/index.metricsBuilder';
import convertToNanoSecondsToSecond from 'lib/convertToNanoSecondsToSecond';
import { colors } from 'lib/getRandomColor';
import history from 'lib/history';
import {
	convertRawQueriesToTraceSelectedTags,
	resourceAttributesToTagFilterItems,
} from 'lib/resourceAttributes';
import React, { useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { UpdateTimeInterval } from 'store/actions';
import { AppState } from 'store/reducers';
import { Widgets } from 'types/api/dashboard/getAll';
import MetricReducer from 'types/reducer/metrics';

import {
	errorPercentage,
	operationPerSec,
} from '../MetricsPageQueries/OverviewQueries';
import { Card, Col, GraphContainer, GraphTitle, Row } from '../styles';
import TopOperationsTable from '../TopOperationsTable';
import { Button } from './styles';

function Application({ getWidgetQueryBuilder }: DashboardProps): JSX.Element {
	const { servicename } = useParams<{ servicename?: string }>();
	const selectedTimeStamp = useRef(0);
	const dispatch = useDispatch();

	const {
		topOperations,
		serviceOverview,
		resourceAttributeQueries,
		topLevelOperations,
	} = useSelector<AppState, MetricReducer>((state) => state.metrics);

	const selectedTraceTags: string = JSON.stringify(
		convertRawQueriesToTraceSelectedTags(resourceAttributeQueries, 'array') || [],
	);

	const tagFilterItems = useMemo(
		() => resourceAttributesToTagFilterItems(resourceAttributeQueries) || [],
		[resourceAttributeQueries],
	);

	const operationPerSecWidget = useMemo(
		() =>
			getWidgetQueryBuilder({
				queryType: 1,
				promQL: [],
				metricsBuilder: operationPerSec({
					servicename,
					tagFilterItems,
					topLevelOperations,
				}),
				clickHouse: [],
			}),
		[getWidgetQueryBuilder, servicename, topLevelOperations, tagFilterItems],
	);

	const errorPercentageWidget = useMemo(
		() =>
			getWidgetQueryBuilder({
				queryType: 1,
				promQL: [],
				metricsBuilder: errorPercentage({
					servicename,
					tagFilterItems,
					topLevelOperations,
				}),
				clickHouse: [],
			}),
		[servicename, topLevelOperations, tagFilterItems, getWidgetQueryBuilder],
	);

	const onTracePopupClick = (timestamp: number): void => {
		const currentTime = timestamp;
		const tPlusOne = timestamp + 1 * 60 * 1000;

		const urlParams = new URLSearchParams();
		urlParams.set(METRICS_PAGE_QUERY_PARAM.startTime, currentTime.toString());
		urlParams.set(METRICS_PAGE_QUERY_PARAM.endTime, tPlusOne.toString());

		history.replace(
			`${
				ROUTES.TRACE
			}?${urlParams.toString()}&selected={"serviceName":["${servicename}"]}&filterToFetchData=["duration","status","serviceName"]&spanAggregateCurrentPage=1&selectedTags=${selectedTraceTags}&&isFilterExclude={"serviceName":false}&userSelectedFilter={"status":["error","ok"],"serviceName":["${servicename}"]}&spanAggregateCurrentPage=1`,
		);
	};

	const onClickHandler = async (
		event: ChartEvent,
		elements: ActiveElement[],
		chart: Chart,
		data: ChartData,
		from: string,
	): Promise<void> => {
		if (event.native) {
			const points = chart.getElementsAtEventForMode(
				event.native,
				'nearest',
				{ intersect: true },
				true,
			);

			const id = `${from}_button`;
			const buttonElement = document.getElementById(id);

			if (points.length !== 0) {
				const firstPoint = points[0];

				if (data.labels) {
					const time = data?.labels[firstPoint.index] as Date;

					if (buttonElement) {
						buttonElement.style.display = 'block';
						buttonElement.style.left = `${firstPoint.element.x}px`;
						buttonElement.style.top = `${firstPoint.element.y}px`;
						selectedTimeStamp.current = time.getTime();
					}
				}
			} else if (buttonElement && buttonElement.style.display === 'block') {
				buttonElement.style.display = 'none';
			}
		}
	};

	const onDragSelect = useCallback(
		(start: number, end: number) => {
			const startTimestamp = Math.trunc(start);
			const endTimestamp = Math.trunc(end);

			dispatch(UpdateTimeInterval('custom', [startTimestamp, endTimestamp]));
		},
		[dispatch],
	);

	const onErrorTrackHandler = (timestamp: number): void => {
		const currentTime = timestamp;
		const tPlusOne = timestamp + 1 * 60 * 1000;

		const urlParams = new URLSearchParams();
		urlParams.set(METRICS_PAGE_QUERY_PARAM.startTime, currentTime.toString());
		urlParams.set(METRICS_PAGE_QUERY_PARAM.endTime, tPlusOne.toString());

		history.replace(
			`${
				ROUTES.TRACE
			}?${urlParams.toString()}&selected={"serviceName":["${servicename}"],"status":["error"]}&filterToFetchData=["duration","status","serviceName"]&spanAggregateCurrentPage=1&selectedTags=${selectedTraceTags}&isFilterExclude={"serviceName":false,"status":false}&userSelectedFilter={"serviceName":["${servicename}"],"status":["error"]}&spanAggregateCurrentPage=1`,
		);
	};

	return (
		<>
			<Row gutter={24}>
				<Col span={12}>
					<Button
						type="default"
						size="small"
						id="Service_button"
						onClick={(): void => {
							onTracePopupClick(selectedTimeStamp.current);
						}}
					>
						View Traces
					</Button>
					<Card>
						<GraphTitle>Latency</GraphTitle>
						<GraphContainer>
							<Graph
								onClickHandler={(ChartEvent, activeElements, chart, data): void => {
									onClickHandler(ChartEvent, activeElements, chart, data, 'Service');
								}}
								name="service_latency"
								type="line"
								data={{
									datasets: [
										{
											data: serviceOverview.map((e) =>
												parseFloat(convertToNanoSecondsToSecond(e.p99)),
											),
											borderColor: colors[0],
											label: 'p99 Latency',
											showLine: true,
											borderWidth: 1.5,
											spanGaps: true,
											pointRadius: 1.5,
										},
										{
											data: serviceOverview.map((e) =>
												parseFloat(convertToNanoSecondsToSecond(e.p95)),
											),
											borderColor: colors[1],
											label: 'p95 Latency',
											showLine: true,
											borderWidth: 1.5,
											spanGaps: true,
											pointRadius: 1.5,
										},
										{
											data: serviceOverview.map((e) =>
												parseFloat(convertToNanoSecondsToSecond(e.p50)),
											),
											borderColor: colors[2],
											label: 'p50 Latency',
											showLine: true,
											borderWidth: 1.5,
											spanGaps: true,
											pointRadius: 1.5,
										},
									],
									labels: serviceOverview.map(
										(e) =>
											new Date(parseFloat(convertToNanoSecondsToSecond(e.timestamp))),
									),
								}}
								yAxisUnit="ms"
								onDragSelect={onDragSelect}
							/>
						</GraphContainer>
					</Card>
				</Col>

				<Col span={12}>
					<Button
						type="default"
						size="small"
						id="Rate_button"
						onClick={(): void => {
							onTracePopupClick(selectedTimeStamp.current);
						}}
					>
						View Traces
					</Button>
					<Card>
						<GraphTitle>Rate (ops/s)</GraphTitle>
						<GraphContainer>
							<FullView
								name="operations_per_sec"
								fullViewOptions={false}
								onClickHandler={(event, element, chart, data): void => {
									onClickHandler(event, element, chart, data, 'Rate');
								}}
								widget={operationPerSecWidget}
								yAxisUnit="ops"
								onDragSelect={onDragSelect}
							/>
						</GraphContainer>
					</Card>
				</Col>
			</Row>
			<Row gutter={24}>
				<Col span={12}>
					<Button
						type="default"
						size="small"
						id="Error_button"
						onClick={(): void => {
							onErrorTrackHandler(selectedTimeStamp.current);
						}}
					>
						View Traces
					</Button>

					<Card>
						<GraphTitle>Error Percentage</GraphTitle>
						<GraphContainer>
							<FullView
								name="error_percentage_%"
								fullViewOptions={false}
								onClickHandler={(ChartEvent, activeElements, chart, data): void => {
									onClickHandler(ChartEvent, activeElements, chart, data, 'Error');
								}}
								widget={errorPercentageWidget}
								yAxisUnit="%"
								onDragSelect={onDragSelect}
							/>
						</GraphContainer>
					</Card>
				</Col>

				<Col span={12}>
					<Card>
						<TopOperationsTable data={topOperations} />
					</Card>
				</Col>
			</Row>
		</>
	);
}

interface DashboardProps {
	getWidgetQueryBuilder: (query: Widgets['query']) => Widgets;
}

export default Application;
