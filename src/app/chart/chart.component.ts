import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';

@Component({
    selector: 'app-chart',
    templateUrl: './chart.component.html',
    styleUrls: ['./chart.component.css']
})
export class ChartComponent implements OnInit {

    constructor() { }

    ngOnInit() {
        d3.timeFormatDefaultLocale({
            dateTime: '%A, %e %B %Y г. %X',
            date: '%d.%m.%Y',
            time: '%H:%M:%S',
            periods: ['AM', 'PM'],
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thusday', 'Friday', 'Saturday', 'Sunday'],
            shortDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            months: ['January', 'Febuary', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'Octtober', 'November', 'December'],
            shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        });

        const timeFormatter = d3.timeFormat('%d-%m-%Y');

        function chunkHelper(data, numberOfChunks) { // eslint-disable-line
            const result = [];
            let remainingToDistribute = data.length;

            while (result.length < numberOfChunks) {
                const maxNumberOfElementsInChunk = Math.ceil(remainingToDistribute / (numberOfChunks - result.length));
                const currentlyDistributed = data.length - remainingToDistribute;
                const currentChunk = data.slice(currentlyDistributed, currentlyDistributed + maxNumberOfElementsInChunk);

                result.push(currentChunk);
                remainingToDistribute = remainingToDistribute - currentChunk.length;
            }

            return result;
        }

        d3.csv('https://raw.githubusercontent.com/factorymn/d3-in-all-its-glory/master/stats/data.csv', draw);

        function draw(data) {
            const margin = { top: 0, right: 20, bottom: 50, left: 50 };
            const previewMargin = { top: 10, right: 10, bottom: 15, left: 30 };
            const width = 920 - margin.left - margin.right;
            const height = 390 - margin.top - margin.bottom;

            const ratio = 4;

            const previewWidth = width / ratio;
            const previewHeight = height / ratio;

            const x = d3.scaleTime()
                .range([0, width]);

            const y = d3.scaleLinear()
                .range([height, 0]);

            let rescaledX = x;
            let rescaledY = y;

            const previewX = d3.scaleTime()
                .range([0, previewWidth]);

            const previewY = d3.scaleLinear()
                .range([previewHeight, 0]);

            const colorScale = d3.scaleOrdinal(d3.schemeCategory20);

            const zoom = d3.zoom()
                .scaleExtent([0.95, 10])
                .translateExtent([[-100000, -100000], [100000, 100000]])
                .on('start', () => {
                    hoverDot
                        .attr('cx', -5)
                        .attr('cy', 0);
                })
                .on('zoom', zoomed);

            const svg = d3.select('.chart')
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            data.forEach((d) => {
                d.date = new Date(d.date);
                d.percent = +d.percent;
            });

            x.domain(d3.extent(data, d => d.date));
            y.domain([0, d3.max(data, d => d.percent)]);
            previewX.domain(d3.extent(data, d => d.date));
            previewY.domain([0, d3.max(data, d => d.percent)]);
            colorScale.domain(d3.map(data, d => d.regionId).keys());

            const xAxis = d3.axisBottom(x)
                .ticks((width + 2) / (height + 2) * 5)
                .tickSize(-height - 6)
                .tickPadding(10);

            const xAxisPreview = d3.axisBottom(previewX)
                .tickSize(4)
                .tickValues(previewX.domain())
                .tickFormat(d3.timeFormat('%b %Y'));

            const yAxis = d3.axisRight(y)
                .ticks(5)
                .tickSize(7 + width)
                .tickPadding(-15 - width)
                .tickFormat(d => d + '%');

            const yAxisPreview = d3.axisLeft(previewY)
                .tickValues(previewY.domain())
                .tickSize(3)
                .tickFormat(d => Math.round(d) + '%');

            const xAxisElement = svg.append('g')
                .attr('class', 'axis x-axis')
                .attr('transform', `translate(0,${height + 6})`)
                .call(xAxis);

            const yAxisElement = svg.append('g')
                .attr('transform', 'translate(-7, 0)')
                .attr('class', 'axis y-axis')
                .call(yAxis);

            svg.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(x).ticks(0));

            svg.append('g')
                .call(d3.axisLeft(y).ticks(0));

            svg.append('defs').append('clipPath')
                .attr('id', 'clip')
                .append('rect')
                .attr('width', width)
                .attr('height', height);

            const nestByRegionId = d3.nest()
                .key(d => d.regionId)
                .sortKeys((v1, v2) => (parseInt(v1, 10) > parseInt(v2, 10) ? 1 : -1))
                .entries(data);

            const regionsNamesById = {};

            nestByRegionId.forEach(item => {
                regionsNamesById[item.key] = item.values[0].regionName;
            });

            const regions = {};

            d3.map(data, d => d.regionId)
                .keys()
                .forEach((d, i) => {
                    regions[d] = {
                        data: nestByRegionId[i].values,
                        enabled: true
                    };
                });

            const regionsIds = Object.keys(regions);

            const lineGenerator = d3.line()
                .x(d => rescaledX(d.date))
                .y(d => rescaledY(d.percent))
                .curve(d3.curveCardinal);

            const nestByDate = d3.nest()
                .key(d => d.date)
                .entries(data);

            const percentsByDate = {};

            nestByDate.forEach(dateItem => {
                percentsByDate[dateItem.key] = {};

                dateItem.values.forEach(item => {
                    percentsByDate[dateItem.key][item.regionId] = item.percent;
                });
            });

            const legendContainer = d3.select('.legend');
            const chunkedRegionsIds = chunkHelper(regionsIds, 3);

            const legends = legendContainer.selectAll('div.legend-column')
                .data(chunkedRegionsIds)
                .enter()
                .append('div')
                .attr('class', 'legend-column')
                .selectAll('div.legend-item')
                .data(d => d)
                .enter()
                .append('div')
                .attr('class', 'legend-item')
                .on('click', clickLegendHandler);

            legends.append('div')
                .attr('class', 'legend-item-color')
                .style('background-color', regionId => colorScale(regionId));

            legends.append('div')
                .attr('class', 'legend-item-text')
                .text(regionId => regionsNamesById[regionId]);

            const legendsValues = legends.append('div')
                .attr('class', 'legend-value');

            const legendsDate = d3.selectAll('.legend-column')
                .append('div')
                .attr('class', 'legend-date');

            const extraOptionsContainer = d3.select('.extra-options-container');

            extraOptionsContainer.append('span')
                .attr('class', 'hide-all-option')
                .text('Hide-all-option')
                .on('click', () => {
                    regionsIds.forEach(regionId => {
                        regions[regionId].enabled = false;
                    });

                    redrawChart();
                });

            extraOptionsContainer.append('span')
                .attr('class', 'show-all-option')
                .text('Show-all-option')
                .on('click', () => {
                    regionsIds.forEach(regionId => {
                        regions[regionId].enabled = true;
                    });

                    redrawChart();
                });

            const linesContainer = svg.append('g')
                .attr('clip-path', 'url(#clip)');

            let singleLineSelected = false;

            const voronoi = d3.voronoi()
                .x(d => x(d.date))
                .y(d => y(d.percent))
                .extent([[0, 0], [width, height]]);

            const hoverDot = svg.append('circle')
                .attr('class', 'dot')
                .attr('r', 3)
                .attr('clip-path', 'url(#clip)')
                .style('visibility', 'hidden');

            const voronoiGroup = svg.append('g')
                .attr('class', 'voronoi-parent')
                .attr('clip-path', 'url(#clip)')
                .append('g')
                .attr('class', 'voronoi')
                .on('mouseover', () => {
                    legendsDate.style('visibility', 'visible');
                    hoverDot.style('visibility', 'visible');
                })
                .on('mouseout', () => {
                    legendsValues.text('');
                    legendsDate.style('visibility', 'hidden');
                    hoverDot.style('visibility', 'hidden');
                });

            const zoomNode = d3.select('.voronoi-parent').call(zoom);

            d3.select('.reset-zoom-button').on('click', () => {
                rescaledX = x;
                rescaledY = y;

                d3.select('.voronoi-parent').transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            });

            d3.select('#show-voronoi')
                .property('disabled', false)
                .on('change', () => {
                    voronoiGroup.classed('voronoi-show', this.checked);
                });

            const preview = d3.select('.preview')
                .append('svg')
                .style('width', previewWidth + previewMargin.left + previewMargin.right)
                .style('height', previewHeight + previewMargin.top + previewMargin.bottom)
                .append('g')
                .attr('transform', `translate(${previewMargin.left},${previewMargin.top})`);

            const previewContainer = preview.append('g');

            preview.append('g')
                .attr('class', 'preview-axis x-axis')
                .attr('transform', `translate(0,${previewHeight})`)
                .call(xAxisPreview);

            preview.append('g')
                .attr('class', 'preview-axis y-axis')
                .attr('transform', 'translate(0, 0)')
                .call(yAxisPreview);

            previewContainer.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', previewWidth)
                .attr('height', previewHeight)
                .attr('fill', '#dedede');

            const previewLineGenerator = d3.line()
                .x(d => previewX(d.date))
                .y(d => previewY(d.percent))
                .curve(d3.curveCardinal);

            const draggedNode = previewContainer
                .append('rect')
                .data([{ x: 0, y: 0 }])
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', previewWidth)
                .attr('height', previewHeight)
                .attr('fill', 'rgba(250, 235, 215, 0.78)')
                .style('cursor', 'move')
                .call(d3.drag().on('drag', dragged));

            function dragged(d) {
                d3.select(this)
                    .attr('x', d.x = d3.event.x)
                    .attr('y', d.y = d3.event.y);

                zoomNode.call(zoom.transform, d3.zoomIdentity
                    .scale(currentTransformationValue)
                    .translate(-d3.event.x * ratio, -d3.event.y * ratio)
                );
            }

            redrawChart();

            function redrawChart(showingRegionsIds = null) {
                const enabledRegionsIds = showingRegionsIds || regionsIds.filter(regionId => regions[regionId].enabled);

                const paths = linesContainer
                    .selectAll('.line')
                    .data(enabledRegionsIds);

                paths.exit().remove();

                if (enabledRegionsIds.length === 1) {
                    const previewPath = previewContainer
                        .selectAll('path')
                        .data(enabledRegionsIds);

                    previewPath.exit().remove();

                    previewPath
                        .enter()
                        .append('path')
                        .merge(previewPath)
                        .attr('class', 'line')
                        .attr('d', regionId => previewLineGenerator(regions[regionId].data)
                        )
                        .style('stroke', regionId => colorScale(regionId));
                }

                paths
                    .enter()
                    .append('path')
                    .merge(paths)
                    .attr('class', 'line')
                    .attr('id', regionId => `region-${regionId}`)
                    .attr('d', regionId => lineGenerator(regions[regionId].data)
                    )
                    .style('stroke', regionId => colorScale(regionId));

                legends.each((regionId) => {
                    const isEnabledRegion = enabledRegionsIds.indexOf(regionId) >= 0;

                    d3.select(this).classed('disabled', !isEnabledRegion);
                });

                const filteredData = data.filter(dataItem => enabledRegionsIds.indexOf(dataItem.regionId) >= 0);

                const voronoiPaths = voronoiGroup.selectAll('path')
                    .data(voronoi.polygons(filteredData));

                voronoiPaths.exit().remove();

                voronoiPaths.enter()
                    .append('path')
                    .merge(voronoiPaths)
                    .attr('d', d => (d ? `M${d.join('L')}Z` : null))
                    .on('mouseover', voronoiMouseover)
                    .on('mouseout', voronoiMouseout)
                    .on('click', voronoiClick);
            }

            function clickLegendHandler(regionId) {
                if (singleLineSelected) {
                    const newEnabledRegions = singleLineSelected === regionId ? [] : [singleLineSelected, regionId];

                    regionsIds.forEach(currentRegionId => {
                        regions[currentRegionId].enabled = newEnabledRegions.indexOf(currentRegionId) >= 0;
                    });
                } else {
                    regions[regionId].enabled = !regions[regionId].enabled;
                }

                singleLineSelected = false;

                redrawChart();
            }

            function voronoiMouseover(d) {
                const transform = d3.zoomTransform(d3.select('.voronoi-parent').node());

                legendsDate.text(timeFormatter(d.data.date));

                legendsValues.text(dataItem => {
                    const value = percentsByDate[d.data.date][dataItem];

                    return value ? value + '%' : 'Н/Д';
                });

                d3.select(`#region-${d.data.regionId}`).classed('region-hover', true);

                const previewPath = previewContainer
                    .selectAll('path')
                    .data([d.data.regionId]);

                previewPath.exit().remove();

                previewPath
                    .enter()
                    .append('path')
                    .merge(previewPath)
                    .attr('class', 'line')
                    .attr('d', regionId => previewLineGenerator(regions[regionId].data)
                    )
                    .style('stroke', regionId => colorScale(regionId));

                hoverDot
                    .attr('cx', () => rescaledX(d.data.date))
                    .attr('cy', () => rescaledY(d.data.percent));
            }

            function voronoiMouseout(d) {
                if (d) {
                    d3.select(`#region-${d.data.regionId}`).classed('region-hover', false);
                }
            }

            function voronoiClick(d) {
                if (singleLineSelected) {
                    singleLineSelected = false;

                    redrawChart();
                } else {
                    const regionId = d.data.regionId;

                    singleLineSelected = regionId;

                    redrawChart([regionId]);
                }
            }

            let currentTransformationValue = 1;

            function zoomed() {
                const transformation = d3.event.transform;

                rescaledX = transformation.rescaleX(x);
                rescaledY = transformation.rescaleY(y);

                xAxisElement.call(xAxis.scale(rescaledX));
                yAxisElement.call(yAxis.scale(rescaledY));

                linesContainer.selectAll('path')
                    .attr('d', regionId => {
                        return d3.line()
                            .defined(d => d.percent !== 0)
                            .x(d => rescaledX(d.date))
                            .y(d => rescaledY(d.percent))
                            .curve(d3.curveCardinal)(regions[regionId].data);
                    });

                voronoiGroup
                    .attr('transform', transformation);

                const xPreviewPosition = previewX.range().map(transformation.invertX, transformation)[0];
                const yPreviewPosition = previewY.range().map(transformation.invertY, transformation)[1];

                currentTransformationValue = transformation.k;

                draggedNode
                    .data([{ x: xPreviewPosition / ratio, y: yPreviewPosition / ratio }])
                    .attr('x', d => d.x)
                    .attr('y', d => d.y)
                    .attr('width', previewWidth / transformation.k)
                    .attr('height', previewHeight / transformation.k);
            }
        }
    }

}
