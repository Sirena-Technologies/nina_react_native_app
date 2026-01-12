# Action Files

Place your robot action sequence files in this directory.

## File Format

Each action file should contain comma-separated byte values, one sequence per line.

Example `front.txt`:
```
0,1,2,3,4,5
10,20,30,40,50
100,101,102,103,104
```

## Required Files

Based on the remote control implementation, you'll need:

- `front.txt` - Move forward
- `back.txt` - Move backward
- `t_left.txt` - Turn left
- `t_right.txt` - Turn right
- `tilt_front.txt` - Tilt forward
- `tilt_back.txt` - Tilt backward
- `tilt_left.txt` - Tilt left
- `tilt_right.txt` - Tilt right
- `l_left.txt` - Lateral left
- `l_right.txt` - Lateral right
- `stance.txt` - Neutral stance
- `stand.txt` - Stand up
- `sit.txt` - Sit down

## Note

These files need to be bundled with your app. In Expo, you may need to:
1. Place them in the `assets` folder
2. Reference them in `app.json` if needed
3. Or load them from a server at runtime
