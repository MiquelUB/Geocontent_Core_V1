export function generateHeatmapUrl(points: {lat: number, lng: number, intensity: number}[]): string {
    // For heatmap, a static map with markers or a configured QuickChart might be complex via URL.
    // For MVP, we can use a simple QuickChart bar/line/pie.
    // Heatmap usually requires a map provider. 
    // Let's fallback to "Punts més visitats" as a Horizontal Bar Chart for now, as it's easier to render in PDF via image.
    
    // Placeholder implementation
    return "https://quickchart.io/chart?c={type:'bar',data:{labels:['Mirador','Ermita','Cascada'],datasets:[{label:'Visitas',data:[120,80,50]}]}}";
}

export function generateBarChartUrl(data: {label: string, value: number}[]): string {
    const chartConfig = {
        type: 'bar',
        data: {
          labels: data.map(d => d.label),
          datasets: [{
            label: 'Afluència',
            data: data.map(d => d.value),
            backgroundColor: 'rgba(86, 143, 114, 0.6)', // Terra/Green from Design System
            borderColor: 'rgba(86, 143, 114, 1)',
            borderWidth: 1
          }]
        },
        options: {
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Afluència per dies' }
            }
        }
      };
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}

export function generatePieChartUrl(locals: number, tourists: number): string {
    const chartConfig = {
        type: 'pie',
        data: {
          labels: ['Locals', 'Turistes'],
          datasets: [{
            data: [locals, tourists],
            backgroundColor: [
                'rgba(86, 143, 114, 0.8)', // Terra
                'rgba(249, 247, 242, 0.8)'  // Crema (might be too light, using a secondary color)
            ]
          }]
        },
        options: {
            plugins: {
                title: { display: true, text: 'Origen dels visitants' }
            }
        }
      };
      // Override crema for better visibility if needed, or stick to brand.
      // Modifying crema to a darker variant for chart visibility if needed.
    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}
