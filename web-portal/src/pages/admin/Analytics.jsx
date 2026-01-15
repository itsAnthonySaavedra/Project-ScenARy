import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const AdminAnalytics = () => {
    const visitorData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Total Visitors',
                data: [1200, 1900, 3000, 5000, 4500, 6000],
                borderColor: '#d4af37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                fill: true,
                tension: 0.4,
            },
        ],
    };

    const siteData = {
        labels: ['Fort San Pedro', 'Magellan\'s Cross', 'Basilica', 'Museo Sugbo', 'Yap-Sandiego'],
        datasets: [
            {
                label: 'Visits this Month',
                data: [650, 800, 750, 400, 300],
                backgroundColor: '#855e2e',
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { labels: { color: '#a8a29e' } },
        },
        scales: {
            y: { ticks: { color: '#a8a29e' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            x: { ticks: { color: '#a8a29e' }, grid: { display: false } },
        },
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="charts-grid">
                <div className="chart-card full-width" style={{ height: '400px' }}>
                    <h3>Platform Growth</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <Line data={visitorData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-card full-width" style={{ height: '400px' }}>
                    <h3>Top Performing Sites</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <Bar data={siteData} options={{ ...chartOptions, maintainAspectRatio: false }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminAnalytics;
