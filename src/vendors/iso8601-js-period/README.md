Shared and maintained by [Nezasa](http://www.nezasa.com) | Published under [Apache 2.0 license](http://www.apache.org/licenses/LICENSE-2.0.html) | © Nezasa, 2012-2013

---

# iso8601-js-period

Javascript library for parsing of ISO 8601 durations. Supported are durations of
the form P3Y6M4DT12H30M17S or PT1S or P1Y4DT1H3S etc.

For documentation of ISO 8601, see

- http://en.wikipedia.org/wiki/ISO_8601

- http://www.iso.org/iso/catalogue_detail?csnumber=40874

## API

All methods of this library are published within the namespace
```nezasa.iso8601.period```. The following methods are currently available.

**Method** ```Array[int] nezasa.iso8601.period.parse(String period, Boolean distributeOverflow)```

Takes a ISO 8601 formatted duration and returns an array with 6 elements, one
per unit. The order of the units, starting with the first element of the array,
is “year”, “month”, "week", “day”, “hour”, “minute”, “second”.

If "distributeOverflow" is set to "true", the overflows are distributed to the higher units.

Examples (distrubtedOverflow = false):

- “PT1S” =\> ```[0, 0, 0, 0, 0, 0, 1]```

- “P1Y4DT1H3S” =\> ```[1, 0, 0, 4, 1, 0, 3]```

- “P3Y6M1W4DT12H30M17S” =\> ```[3, 6, 1, 4, 12, 30, 17]```

Examples (distrubtedOverflow = true):

- “PT90S” =\> ```[0, 0, 0, 0, 0, 1, 30]```

**Method** ```int nezasa.iso8601.Period.parseToTotalSeconds(String period)```

Takes a ISO 8601 formatted duration and returns the total amount of seconds
represented by the duration.

**Method** ```String nezasa.iso8601.Period.parseToString(String period, Boolean distributeOverflow, Array[String] unitNames, Array[String] unitNamesPlural)```

Takes a ISO 8601 formatted duration and returns a more natural representation of
the period. In order to handle different languages, the method takes two input
arrays two define the unit names in singular and plural, e.g., for English it
would be

- ```['year', 'month', 'week', 'day', 'hour', 'minute', 'second']```

- ```['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds']```

The English versions as shown above represent the default, thus the English unit names
are used if unitNames and unitNamesPlural remain ```undefined```.

If "distributeOverflow" is set to "true", the overflows are distributed to the higher units.

## Sample code

Please see the unit tests (file: unittest.html).

## Change Log

A special note about backward compatibility. We hate breaking backward compatibility and try to avoid it. But this lib is tiny, so atm we rather go for new features than always sticking to backward compatibility.
Nevertheless, the aim of this lib is to give nice support for ISO8601. By the static nature of ISOs, this lib should not change to much neither.

### v0.2.0.0 - Feb 23, 2013

- [NEW] Support for week as unity (contributed by @palamedes)
- [NEW] Overflow distribution support (70 seconds => 1 minute 10 seconds)
- [BREAKS] The returned array has length 7 (before 6) because of the week unity.

### v0.1.0.0 - Dec 11, 2012

- initial release
