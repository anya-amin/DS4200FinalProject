const width = 800, height = 600;
const svg = d3.select("#map");

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const normalize = str => str.toLowerCase().replace(/\s+/g, '');

Promise.all([
  d3.json("boston_neighborhoods.geojson"),
  d3.csv("cleaned_listings.csv")
]).then(([geojson, data]) => {
  const priceByNeighborhood = {};
  const listingsCount = {};

  data.forEach(d => {
    if (d.neighbourhood) {
      const n = normalize(d.neighbourhood);
      listingsCount[n] = (listingsCount[n] || 0) + 1;
      if (d.price_per_night) {
        priceByNeighborhood[n] = +d.price_per_night;
      }
    }
  });

  const prices = Object.values(priceByNeighborhood);
  const minPrice = d3.min(prices);
  const maxPrice = d3.max(prices);

  const color = d3.scaleLinear()
    .domain([minPrice, (minPrice + maxPrice) / 2, maxPrice])
    .range(["#FFD2B8", "#FC642D", "#B23A00"]);

  const strokeScale = d3.scaleLinear()
    .domain([d3.min(Object.values(listingsCount)), d3.max(Object.values(listingsCount))])
    .range([1, 6]);

  const path = d3.geoPath();
  const bounds = path.bounds(geojson);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const x = (bounds[0][0] + bounds[1][0]) / 2;
  const y = (bounds[0][1] + bounds[1][1]) / 2;
  const scale = 0.95 / Math.max(dx / width, dy / height);
  const translate = [width / 2 - scale * x, height / 2 - scale * y];

  const projection = d3.geoTransform({
    point: function(lon, lat) {
      this.stream.point(lon * scale + translate[0], lat * scale + translate[1]);
    }
  });

  const geoPath = d3.geoPath().projection(projection);

  svg.append("g")
    .selectAll("path")
    .data(geojson.features)
    .enter().append("path")
    .attr("d", geoPath)
    .attr("fill", d => {
      const n = normalize(d.properties.name);
      return priceByNeighborhood[n] ? color(priceByNeighborhood[n]) : "#ccc";
    })
    .attr("stroke", "#FF5A5F")
    .attr("stroke-width", d => {
      const n = normalize(d.properties.name);
      return listingsCount[n] ? strokeScale(listingsCount[n]) : 1;
    })
    .on("mouseover", function(event, d) {
      const n = normalize(d.properties.name);
      tooltip.transition().duration(200).style("opacity", .9);
      tooltip.html(`
        <strong>${d.properties.name}</strong><br/>
        Avg Price: $${priceByNeighborhood[n] || "N/A"}<br/>
        Listings: ${listingsCount[n] || 0}
      `)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });

  // Price legend
  const legendWidth = 300, legendHeight = 10;
  const legendSvg = d3.select("#legend").append("svg")
    .attr("width", legendWidth)
    .attr("height", 50);

  legendSvg.append("text")
    .attr("x", 0)
    .attr("y", 10)
    .text("Price per Night (Orange Fill)")
    .style("font-size", "12px")
    .style("fill", "#333");

  const defs = legendSvg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "linear-gradient");

  linearGradient.selectAll("stop")
    .data(d3.range(0, 1.01, 0.1))
    .enter().append("stop")
    .attr("offset", d => d * 100 + "%")
    .attr("stop-color", d => color(minPrice + d * (maxPrice - minPrice)));

  legendSvg.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("y", 15)
    .style("fill", "url(#linear-gradient)");

  const xScale = d3.scaleLinear()
    .domain([minPrice, maxPrice])
    .range([0, legendWidth]);

  const xAxis = d3.axisBottom(xScale)
    .ticks(5)
    .tickFormat(d => "$" + d);

  legendSvg.append("g")
    .attr("transform", `translate(0,${legendHeight + 15})`)
    .call(xAxis);

  // Density legend
  const densityLegendSvg = d3.select("#density-legend").append("svg")
    .attr("width", 300)
    .attr("height", 80);

  densityLegendSvg.append("text")
    .attr("x", 0)
    .attr("y", 15)
    .text("Listings Density (Pink Border Thickness)")
    .style("font-size", "12px")
    .style("fill", "#333");

  const sampleCounts = [
    d3.min(Object.values(listingsCount)),
    Math.round((d3.min(Object.values(listingsCount)) + d3.max(Object.values(listingsCount))) / 2),
    d3.max(Object.values(listingsCount))
  ];

  densityLegendSvg.selectAll("rect")
    .data(sampleCounts)
    .enter().append("rect")
    .attr("x", (d, i) => i * 100)
    .attr("y", 25)
    .attr("width", 40)
    .attr("height", 20)
    .attr("fill", "#FFD2B8")
    .attr("stroke", "#FF5A5F")
    .attr("stroke-width", d => strokeScale(d));

  densityLegendSvg.selectAll("text.labels")
    .data(sampleCounts)
    .enter().append("text")
    .attr("class", "labels")
    .attr("x", (d, i) => i * 100 + 20)
    .attr("y", 65)
    .attr("text-anchor", "middle")
    .text(d => d + " listings")
    .style("font-size", "11px")
    .style("fill", "#333");
});
