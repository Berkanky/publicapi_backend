function format_date_yyyy_mm_dd(date) {
    var d = new Date(String(date));

    var year = d.getFullYear();

    var month = (d.getMonth() + 1).toString();
    if (month.length < 2) month = "0" + month;

    var day = d.getDate().toString();
    if (day.length < 2) day = "0" + day;

    return year + "-" + month + "-" + day;
};

module.exports = format_date_yyyy_mm_dd;