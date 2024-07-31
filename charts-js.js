const charts = () => {
  const data = {
    labels: ["Jan", "Feb", "Mar"],
    datasets: [
      {
        label: "Fully Rounded",
        data: [1, 2, 3],
        borderColor: "#1111ffff",
        backgroundColor: "rgb(0,0,255, 0.5)",
        borderWidth: 2,
        borderRadius: 200,
        borderSkipped: false,
      },
      {
        label: "Small Radius",
        data: [4, 5, 6],
        borderColor: "rgb(255,0,128)",
        backgroundColor: "rgb(128,128,128,0.5)",
        borderWidth: 2,
        borderRadius: 5,
        borderSkipped: false,
      },
    ],
  };
  const config = {
    type: "bar",
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: "Chart.js Bar Chart",
        },
        animation: false,
        responsiveAnimationDuration: 0,
      },
    },
  };
};

const test = "";
