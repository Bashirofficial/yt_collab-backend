const generateProjectCode = () => {
  const random = Math.random().toString(16).substr(2, 8).toUpperCase();
  return `PROJ_${random}`;
};

export default generateProjectCode;
