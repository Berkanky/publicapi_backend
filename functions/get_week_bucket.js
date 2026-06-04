function get_week_bucket(date_input) {
    var date = new Date(date_input);

    date.setHours(0, 0, 0, 0);

    var day_num = date.getDay() || 7;

    date.setDate(date.getDate() + 4 - day_num);

    var year_start = new Date(date.getFullYear(), 0, 1);

    var week_no = Math.ceil((((date - year_start) / 86400000) + 1) / 7);

    return date.getFullYear() + "-W" + String(week_no).padStart(2, "0");
};

module.exports = get_week_bucket;