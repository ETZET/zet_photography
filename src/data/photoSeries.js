// S3 storage configuration
const seriesConfig = [
  {
    id: 1,
    title: "Flower Decay",
    s3Prefix: "images/flowerdecay",
    images: [
      "flower0.jpg", "flower1.jpg", "flower2.jpg", "flower3.jpg", "flower4.jpg",
      "flower5.jpg", "flower6.jpg", "flower7.jpg", "flower8.jpg", "flower9.jpg",
      "flower10.jpg", "flower11.jpg", "flower12.jpg", "flower13.jpg", "flower14.jpg",
      "flower15.jpg", "flower16.jpg", "flower17.jpg", "flower18.jpg", "flower19.jpg",
      "flower20.jpg", "flower21.jpg", "flower22.jpg", "flower23.jpg", "flower24.jpg",
      "flower25.jpg", "flower26.jpg", "flower27.jpg", "flower28.jpg", "flower29.jpg",
      "flower30.jpg", "flower31.jpg", "flower32.jpg", "flower33.jpg", "flower34.jpg",
      "flower35.jpg", "flower36.jpg", "flower37.jpg", "flower38.jpg"
    ]
  },
  {
    id: 2,
    title: "Plants Autopsy",
    s3Prefix: "images/scanner",
    images: [
      "img20230423_12502676.jpg", "img20230423_12511646.jpg", "img20230423_12520227.jpg",
      "img20230423_12524256.jpg", "img20230423_12591380.jpg", "img20230423_13001280.jpg",
      "img20230423_13005920.jpg", "img20230423_13014120.jpg", "img20230423_13023430.jpg",
      "img20230423_13032332.jpg", "img20230423_13040312.jpg", "img20230423_13050692.jpg",
      "img20230423_13062462.jpg", "img20230423_13072873.jpg", "img20230423_13081452.jpg",
      "img20230423_13100272.jpg"
    ]
  },
  {
    id: 3,
    title: "Random Iphone Pics",
    s3Prefix: "images/iphone",
    images: [
      "car.jpg", "cat.jpg", "curb.jpg", "house.jpg", "road.jpg",
      "sand.jpg", "shell.jpg", "sky.jpg", "tree.jpg", "window.jpg"
    ]
  }
];

// Function to get all image files from S3
const getImagesFromS3 = (s3Prefix, imageList) => {
  return imageList.map((filename, index) => ({
    id: index + 1,
    src: `${s3Prefix}/${filename}`,
    title: filename.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));
};

// Function to initialize all photo series
export const initializePhotoSeries = async () => {
  const series = seriesConfig.map((config) => ({
    ...config,
    photos: getImagesFromS3(config.s3Prefix, config.images)
  }));
  return series;
};