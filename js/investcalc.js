"use strict";

var freqtext = {
    '365': 'day',
    '52': 'week',
    '26': 'fortnight',
    '12': 'month',
    '4': 'quarter',
    '2': '6 months',
    '1': 'year'
};

var saveFreq = parseInt($('#savefreq').val());
checkLongFreqWarning();
var origSaveFreq = 0;
var origSavings = 0;
var chart;

function updateSavingsLabel() {
    $('#savingsLabel').text('Savings per ' + freqtext[saveFreq]);
}

updateSavingsLabel();

$('#savefreq').change(function () {
    var newFreq = parseInt($('#savefreq').val());
    if (newFreq == saveFreq) return;
    var oldFreq = saveFreq;
    saveFreq = newFreq;
    checkLongFreqWarning();
    updateSavingsLabel();
    if (origSaveFreq == 0 || Number.isNaN(origSavings)) {
        origSaveFreq = oldFreq;
        origSavings = parseInt($('#savings').val());
    }
    if (Number.isNaN(origSavings)) return;
    $('#savings').val(Math.round(origSavings/newFreq*origSaveFreq));
});

$('#savings').change(function () {
    origSaveFreq = 0;
});

function updateCalc() {
    var res = $('#result').hide();

    var savings = parseInt($('#savings').val());
    var interval = 1.0/saveFreq;
    var interest = parseFloat($('#interest').val())/100;
    var growth = parseFloat($('#growth').val())/100;
    var brokerage = parseFloat($('#brokerage').val());

    if (Number.isNaN(savings) || Number.isNaN(interest)
        || Number.isNaN(growth) || Number.isNaN(brokerage)) return;

    // approximate interest = 0 if it's very small
    if (interest > -0.001 && interest < 0.001) interest = 0;

    var opt = freqCalc(savings, interval, interest, growth, brokerage);

    var parcelsize = Math.round(addInterest(savings, interest, interval, opt));
    var timeunits = freqtext[saveFreq];

    var altopt = opt;

    if (saveFreq == 2) {
        /* special case for 6-monthly investment */
        timeunits = 'month';
        altopt *= 6;
    }

    if (altopt != 1) timeunits = timeunits + "s";

    var output;
    if (altopt == 0) {
        output = "Better not to invest as expected returns are no greater than the interest rate on savings.";
        if (growth > interest) {
            output += " (Note that after monthly compounding, the interest rate here comes to "+(100*(Math.pow(1+interest/12,12)-1)).toFixed(2)+"% p.a.)";
        }
    } else {
        output = "Invest $"+parcelsize+" once every "+(altopt == 1 ? '' : altopt+" ")+timeunits+'.';
        var extra = '';
        var hasinterest = (parcelsize > opt*savings);
        if (brokerage > 0 && hasinterest) {
            extra = 'This amount includes the brokerage fee and $'+Math.round(parcelsize-opt*savings)+' interest.';
        } else if (brokerage > 0) {
            extra = 'This amount includes the brokerage fee.';
        }
        if (extra !== '') output += '<br><span class="extranote">'+extra+'</span>';
    }
    res.html(output).show();

    updateChart(opt, interval, savings, interest, growth, brokerage);
}

function freqCalc(s, d, r, g, b) {
    if (s <= 0) return 0;
    if (b == 0) return 1;
    if (g < 0) return 0;
    var R = Math.pow(1+r/12, 12*d);
    var G = Math.pow(1+g, d);
    if (R>G) return 0;
    var alpha = (s-b+b*R)*Math.log(G);
    var beta = s*Math.log(G/R);
    var gamma = s*Math.log(R);

    if (r == 0) {
        var delta = 1-b/s-1/Math.log(G);
        var c0 = (Math.pow(Math.log(G),2)*G*beta*delta + 2*Math.log(G)*G*beta)/2;
        var c1 = Math.log(G)*G*beta*delta+G*beta;
        var c2 = G*beta*delta + s;
    } else {
        var c0 = (alpha * G/R * Math.pow(Math.log(G/R),2) - beta * Math.pow(Math.log(G),2))/2;
        var c1 = alpha * G/R * Math.log(G/R) - beta * G * Math.log(G);
        var c2 = alpha * G/R - beta * G - gamma;
    }

    var n = Math.round(1 + Math.sqrt(c1*c1-4*c0*c2)/Math.abs(2*c0) - c1/(2*c0));

    var bestf = -1;
    var bestn = 0;
    for (var i=n-2; i<=n+2; i++) {
        if (i<1) continue;
        var f = fv(s,d,r,g,b,i,Math.round(20/d));
        if (f >= bestf) {
            bestf = f;
            bestn = i;
        }
    }

    return bestn;
}

function fv(s, d, r, g, b, n, t) {
    var R = Math.pow(1+r/12, 12*d);
    var G = Math.pow(1+g, d);

    if (r == 0) {
        return (n*s-b)*(1-Math.pow(G,t))/(1-Math.pow(G,n));
    }

    return (s*(1-Math.pow(R,n))-b*(1-R))*(1-Math.pow(G,t))/((1-R)*(1-Math.pow(G,n)));
}

function addInterest(s, r, d, n) {
    var R = Math.pow(1+r/12, 12*d);
    if (r == 0) return s*n;
    return s*(1-Math.pow(R,n))/(1-R);
}

function updateChart(opt, interval, savings, interest, growth, brokerage) {
    if (opt == 0) {
        $('#chart').hide();
        return;
    }
    $('#chart').show();
    var years = 10;

    var nvals = [opt, 2*opt];
    var borderColors = ['rgba(228,26,28,1.0)', 'rgba(152,78,163,0.8)'];
    var backgroundColors = ['rgba(228,26,28,0.9)', 'rgba(152,78,163,0.2)'];

    var half = Math.round(opt/2);
    if (half > 1 && half != opt) {
        nvals.unshift(half);
        borderColors.unshift('rgba(77,175,74,0.8)');
        backgroundColors.unshift('rgba(77,175,74,0.2)');
    }
    if (opt > 1) {
        nvals.unshift(1);
        borderColors.unshift('rgba(55,126,184,0.8)');
        backgroundColors.unshift('rgba(55,126,184,0.2)');
    }

    var data = [];
    var labels = [];
    for (var j=0; j<nvals.length; j++) {
        var n = nvals[j];
        var altopt = n;
        var timeunits = freqtext[saveFreq];
        if (saveFreq == 2) {
            altopt *= 6;
            timeunits = 'month';
        }
        if (altopt != 1) timeunits = timeunits + "s";
        var label = 'Every '+(altopt == 1 ? '' : altopt+" ")+timeunits;
        labels.push(label);
        data.push(Math.round(fv(savings,interval,interest,growth,brokerage,nvals[j],years/interval)));
    }
    if (typeof chart == 'undefined') {
        var ctx = document.getElementById('chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['After '+years+' years'],
                datasets: []
            },
            options: {
                legend: {
                    display: true
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            var label = data.datasets[tooltipItem.datasetIndex].label;
                            var dollars = tooltipItem.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                            return label+': $'+dollars;
                        }
                    }
                },
                scales: {
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Approx. total invested ($)'
                        }
                    }]
                }
            }
        });
    }
    while (chart.data.datasets.length < nvals.length) chart.data.datasets.push({
        borderWidth: 1
    });
    while (chart.data.datasets.length > nvals.length) chart.data.datasets.pop();

    for (var j=0; j<nvals.length; j++) {
        chart.data.datasets[j].label = labels[j];
        chart.data.datasets[j].data = [data[j]];
        chart.data.datasets[j].borderColor = borderColors[j];
        chart.data.datasets[j].backgroundColor = backgroundColors[j];
    }

    chart.update();
}

function checkLongFreqWarning() {
    if (saveFreq >= 12) {
        $('#warning').html('').hide();
        return;
    }
    $('#warning').html('The income frequency should be how often the savings actually arise (e.g. part of a fortnightly salary). Most users will want to choose Weekly or Fortnightly for this reason.<br><a href="#" class="btn btn-secondary btn-sm" onClick="$(\'#savefreq\').val(52).change(); return false;">Adjust to weekly values</a> <a href="#" class="btn btn-secondary btn-sm" onClick="$(\'#savefreq\').val(26).change(); return false;">Adjust to fortnightly values</a> <a href="#" class="btn btn-secondary btn-sm" onClick="$(\'#warning\').hide(); return false;">Close this warning</a>').show();
}

$('#freqcalc').change(updateCalc);
updateCalc();
