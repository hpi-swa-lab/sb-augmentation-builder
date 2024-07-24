const chars = () => {
  const data = {
    labels: ["Jan", "Feb", "Mar"],
    datasets: [
      {
        label: "Fully Rounded",
        data: [1, 2, 3],
        borderColor: "#c01c2817",
        backgroundColor: "rgb(128,128,128, 0.5)",
        borderWidth: 2,
        borderRadius: 200,
        borderSkipped: false,
      },
      {
        label: "Small Radius",
        data: [4, 5, 6],
        borderColor: "rgb(128,128,128)",
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
