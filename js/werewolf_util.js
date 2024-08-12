// Helper function to convert milliseconds to MSB and LSB
function msToBytes(ms) {
  const MSB = (ms >> 8) & 0xFF; // Most Significant Byte
  const LSB = ms & 0xFF; // Least Significant Byte
  //console.log(ms, MSB, LSB, MSB.toString(16), LSB.toString(16), ms.toString(16));
  return [MSB, LSB];
}

function readSingleFile(e) { 
  var file = e.target.files[0];
  if (!file) {
    return;
  }
  var reader = new FileReader();
  reader.onload = function(e) {
    app_bin_data['data'] = e.target.result;
    console.log(app_bin_data['data']);
  };
  reader.readAsArrayBuffer(file); //readAsBinaryString, readAsText;
  //reader.readAsText(file); //readAsBinaryString, readAsText;
}
