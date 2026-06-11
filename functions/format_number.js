function format_number(num) {

    num = parseFloat(num).toFixed(3);

    var num_str = num.toString();
    var parts = num_str.split(".");
    var integer_part = parts[0];
    var fractional_part = parts[1];
    integer_part = integer_part.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return integer_part + "," + fractional_part;
};

module.exports = format_number;