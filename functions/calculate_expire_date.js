function calculate_expire_date(param){

    var { hours, minutes } = param;

    var hour_in_ms = 60 * 60 * 1000;
    var minute_in_ms = 60 * 1000;
    var date = new Date().getTime() + (hours * hour_in_ms) + (minutes * minute_in_ms);

    return new Date(date);
};  

module.exports = calculate_expire_date;