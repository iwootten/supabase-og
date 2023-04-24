import { createNoise3D } from "https://esm.sh/simplex-noise";
import Alea from "https://esm.sh/alea";
import { ImageResponse } from 'https://deno.land/x/og_edge/mod.ts';
import React from "https://esm.sh/react@18.2.0";

async function getBackgound(seed: number){
    const pnrg = new Alea(seed);
    const noise3D = createNoise3D(pnrg);
    
    const randomArrayElement = (arr: string | any[]) => {
        return arr[Math.floor(pnrg() * arr.length)];
    };
    
    // hyperparameters
    const WIDTH = 1200;
    const HEIGHT = 675;
    const MAXSCALE = 0.001;
    const MINSCALE = 0.00004;
    const MAXSPACE = 30;
    const MINSPACE = 1;
    const MAXBIGLINESIZE = 80;
    const MAXSMALLLINESIZE = 4;
    const MINSMALLLINESIZE = 1;
    const MAXBIGLINES = 5;
    const MAXMEDLINES = 20;
    const MAXSMALLLINES = 40;
    const MARGIN = 20;
    const SCHEMES = [
        [
            // light
            "#EDEAE6", // background
            "#27272E", // foreground
            "#2D4771",
            "#3b6db6",
            "#4688e7",
            "#319bbc",
            "#19a290",
            "#84b88d",
            "#c6cf96",
            "#F4DA7C",
            "#FAC78F",
            "#f79c7a",
            "#f46161",
            "#C14F87",
            "#754F8D",
        ],
        [
            // dark
            "#233147", // background
            "#EDEAE6", // foreground
            "#375C93",
            "#377BA7",
            "#319BBC",
            "#19A290",
            "#A0BE9A",
            "#E2DDCF",
            "#F7CA6F",
            "#FC975A",
            "#F46161",
            "#C14F87",
            "#754F8D",
            "#5B5690",
        ],
    ];
    
    const CELLSIZE = 2;
    // computed values
    const COLORS = randomArrayElement(SCHEMES);
    const BACKGROUND = COLORS.shift();
    const FOREGROUND = COLORS.shift();
    const CELLSBETWEENLINES = pnrg() * (MAXSPACE - MINSPACE) + MINSPACE;
    const NOISESCALE = pnrg() * (MAXSCALE - MINSCALE) + MINSCALE;
    const COLS = Math.ceil(WIDTH / CELLSIZE);
    const ROWS = Math.ceil(HEIGHT / CELLSIZE);
    const GRID = [...new Array(COLS * ROWS)].map(() => []);
    
    // state variables
    const ACTIVELIST: any[] = [];
    
    const distance = ([x1, y1]: number[], [x2, y2]: number[]) =>
        Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    
    const vectorAtPoint = ([x, y]: number[], cartesian = true) => {
        const angle =
            (1 + noise3D(x * NOISESCALE, y * NOISESCALE, 0)) * Math.PI;
        const magnitude = CELLSIZE * 1.5;
        return cartesian
            ? radialToCart(magnitude, angle)
            : [magnitude, angle];
    };
    
    const radialToCart = (magnitude: number, angle: number) => [
        Math.cos(angle) * magnitude,
        Math.sin(angle) * magnitude,
    ];
    
    const coordsToIndex = ([i, j]: number[]) : number => i + j * COLS;
    
    const gridCellAtPoint = ([x, y]: number[]): number[] => [
        Math.floor(x / CELLSIZE),
        Math.floor(y / CELLSIZE),
    ];
    
    const gridIndexAtPoint = (point: number[]) => {
        const [x, y] = gridCellAtPoint(point);
        return coordsToIndex([x, y]);
    };
    
    const addPointToGrid = (point: number[]) => {
        GRID[gridIndexAtPoint(point)].push(point);
    };
    
    const closeNeighborsToPoint = (point: number[]) =>
        pointsInNeighboringCells(point).filter(
            (neighbor) => distance(neighbor, point) < CELLSIZE
        );
    
    const pointsInNeighboringCells = (point: number[]) => {
        const [i, j] = gridCellAtPoint(point);
        const neighbors = [];
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (
                    i + x >= 0 &&
                    i + x <= COLS &&
                    j + y >= 0 &&
                    j + y <= ROWS
                ) {
                    const neighbor = GRID[coordsToIndex([i + x, j + y])];
                    if (neighbor) {
                        neighbors.push(neighbor);
                    }
                }
            }
        }
        return neighbors.flat();
    };
    
    const pointHasCloseNeighbors = (point: number[]) =>
        closeNeighborsToPoint(point).length !== 0;
    
    const pointIsOutsideCanvas = ([x, y]: number[]) => {
        return (
            x < 0 + MARGIN ||
            x > WIDTH - MARGIN ||
            y < 0 + MARGIN ||
            y > HEIGHT - MARGIN
        );
    };
    
    const randomPointInRect = (w = WIDTH, h = HEIGHT) => {
        return [pnrg() * w, pnrg() * h];
    };
    
    const pointPairNormalToLineAtPoint = ([x, y]: number[], distance = CELLSIZE) => {
        const theta = vectorAtPoint([x, y], false)[1];
        const normal = radialToCart(distance, theta + Math.PI / 2);
        const antiNormal = radialToCart(distance, theta - Math.PI / 2);
        const pointAbove = [x + normal[0], y + normal[1]];
        const pointBelow = [x + antiNormal[0], y + antiNormal[1]];
        return [pointAbove, pointBelow];
    };
    
    const drawFlowLines = (
        seedPoint = randomPointInRect(),
        lineWidth = 1
    ) : FlowLine[] => {
        const flowlines: FlowLine[] = []
    
        ACTIVELIST.push(seedPoint);
    
        while (ACTIVELIST.length > 0) {
            let point = ACTIVELIST.pop();
            if (closeNeighborsToPoint(point, 1).length > 0) {
                continue;
            } else {
                flowlines.push(drawFlowLine(point, lineWidth));
            }
        }
        return flowlines
    };
    
    type FlowLine = {
        path: string;
        color: string;
        width: number;
    }
    
    const drawFlowLine = (
        currentPoint: number[],
        lineSize = 1,
        direction = -1,
        line: number[][] = [],
        splines: number[][][] = []
    ) : FlowLine => {
        // if this is the first segment, add the starting spline to the grid
        // and visited list
        if (line.length === 0) {
            line.push(currentPoint);
            const firstSpline = [currentPoint];
            for (
                let i = 0.5;
                i <= Math.ceil(lineSize / 2) + CELLSBETWEENLINES;
                i++
            ) {
                for (const normalPoint of pointPairNormalToLineAtPoint(
                    currentPoint,
                    i * CELLSIZE
                )) {
                    if (!pointIsOutsideCanvas(normalPoint)) {
                        addPointToGrid(normalPoint);
                        firstSpline.push(normalPoint);
                    }
                }
            }
            splines.push(firstSpline);
        }
    
        // get next point according to flow field vector
        const currentVector = vectorAtPoint(currentPoint);
        const nextPoint = [
            currentPoint[0] + currentVector[0] * direction,
            currentPoint[1] + currentVector[1] * direction,
        ];
    
        const nextSpline = [nextPoint];
        // build a spline for the next line segment
        // add extra points outside stroke to create for space between lines
        for (let i = 0.5; i <= Math.ceil(lineSize / 2 + 1); i++) {
            for (const normalPoint of pointPairNormalToLineAtPoint(
                nextPoint,
                i * CELLSIZE
            )) {
                nextSpline.push(normalPoint);
            }
        }
    
        // get last points visited from last three line segments
        // const lastSplines = splines.slice(-3);
    
        // check if all points in the next spline are valid
        // (inside the field and not intersecting another line)
        // TODO: ignore neighbors if they are in the current line
        if (
            nextSpline.some(pointIsOutsideCanvas) ||
            nextSpline.some(pointHasCloseNeighbors)
        ) {
            if (direction === -1) {
                // if we're going backward and at an edge or intersect, time to go the other way
                // flip the order of the visited points, and set the direction of motion forward
                line.reverse();
                splines.reverse();
                direction = 1;
                // start drawing the flow line from the end of the visited points
                return drawFlowLine(
                    line[line.length - 1],
                    lineSize,
                    direction,
                    line,
                    splines
                );
            } else {
                // let pathA = new Path2D();
                // pathA.moveTo(line[0][0], line[0][1]);
                // for (let i = 1; i < line.length; i++) {
                //     pathA.lineTo(line[i][0], line[i][1]);
                // }
                let flowline: FlowLine = {
                    width: lineSize,
                    color: COLORS[
                        Math.round(
                            (vectorAtPoint(line[0], false)[1] /
                                (Math.PI * 2)) *
                                COLORS.length
                        )
                    ],
                    path: `M${Math.round(line[0][0])} ${Math.round(line[0][1])}`
                }
    
                for (let i = 1; i < line.length; i++) {
                    flowline.path += ` L${Math.round(line[i][0])} ${Math.round(line[i][1])}`
                }
                return flowline;
            }
        } else {
            // find the next flow line segment
            // add point on spline of current line to the grid
            nextSpline.map((p) => {
                addPointToGrid(p);
            });
            // add the next point to the line
            line.push(nextPoint);
            // add some active points for the next flow line
            if (line.length % 4 === 0) {
                for (const normalPoint of pointPairNormalToLineAtPoint(
                    currentPoint,
                    lineSize * CELLSIZE + 2 * CELLSBETWEENLINES * CELLSIZE
                )) {
                    if (!pointIsOutsideCanvas(normalPoint)) {
                        ACTIVELIST.push(normalPoint);
                    }
                }
            }
            return drawFlowLine(nextPoint, lineSize, direction, line, splines);
        }
    };
    
    const BIGLINESIZE = pnrg() * MAXBIGLINESIZE;
    const SMALLLINESIZE = Math.round(
        pnrg() * (MAXSMALLLINESIZE - MINSMALLLINESIZE) + MINSMALLLINESIZE
    );
    
    let lines: FlowLine[] = []
    
    // draw big lines
    for (let i = 0; i < pnrg() * MAXBIGLINES; i++) {
        lines.push(drawFlowLine(randomPointInRect(), BIGLINESIZE))
    }
    for (let i = 0; i < pnrg() * MAXMEDLINES; i++) {
        lines.push(drawFlowLine(randomPointInRect(), BIGLINESIZE / 3));
    }
    for (let i = 0; i < pnrg() * MAXSMALLLINES; i++) {
        lines.push(drawFlowLine(randomPointInRect(), BIGLINESIZE / 6));
    }
    const smallLines = drawFlowLines(randomPointInRect(), SMALLLINESIZE)
    
    lines.push(...smallLines)

    return {
        lines,
        FOREGROUND,
        BACKGROUND,
    }
}


let author:string = "Ian Wootten";
let title:string = "This is the default title";
let subtitle:string = "This is the default subheading";

export const config = {
    runtime: "edge",
}

// eslint-disable-next-line import/no-anonymous-default-export
export default async function handler(req: Request) {
    const params = new URLSearchParams(req.url.split("?")[1]);

    const seed = Number(params.get("seed")) || 0;

    title = params.get("title") || title;
    subtitle = params.get("subtitle") || subtitle;
    author = params.get("author") || author;

    const {lines, FOREGROUND, BACKGROUND} = await getBackgound(seed);

    return new ImageResponse(
        (
            <div style={{
                display: 'flex',
            }}>
                <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
                    <rect width="1200" height="675" fill={BACKGROUND} />
                    {lines.map((line, i) => 
                        <path key={i} d={line.path} stroke={line.color} strokeWidth={line.width} fill="none" />
                    )}
                </svg>
                <div style={{
                    display: 'flex',
                    position: 'absolute', 
                    top: '300px', 
                    left: '80px', 
                    width: '1000px'
                }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{
                        marginBottom: '20px',
                        display: 'flex',
                    }}>
                        <div style={{
                            display: "flex",
                            fontSize: "30px",
                            fontFamily: "Arial",
                            verticalAlign: "middle",
                            background: BACKGROUND,
                            color: FOREGROUND,
                            padding: "10px 20px"
                        }}>
                            <svg
                                width="30px"
                                height="30px"
                                viewBox="0 0 50 50"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                    display: "flex",
                                    marginRight: "10px",
                                    marginTop: "7px"
                                }}
                            >
                                <circle
                                    cx="25"
                                    cy="25"
                                    r="25"
                                    fill="#ECD181"
                                ></circle>
                            </svg>
                            <span>{author}</span>
                        </div>
                    </div>
                    <div style={{
                        marginBottom: '20px',
                        display: 'flex'
                    }}>
                            <div style={{
                                display: "flex",
                                color: FOREGROUND,
                                fontSize: "50px",
                                fontFamily: "Arial",
                                background: BACKGROUND,
                                padding: "0 10px 20px",
                                verticalAlign: "middle",
                                boxDecorationBreak: "clone",
                                WebkitBoxDecorationBreak: "clone",
                                letterSpacing: "-2px",
                                lineHeight: 1.2,
                            }}>{title}</div>
                        </div>
                        <div style={{
                            marginBottom: '20px',
                            display: 'flex'
                        }}>
                            <div style={{
                                display: "flex",
                                color: FOREGROUND,
                                fontSize: "40px",
                                fontFamily: "Arial",
                                background: BACKGROUND,
                                padding: "0 10px 20px",
                                boxDecorationBreak: "clone",
                                WebkitBoxDecorationBreak: "clone",
                                lineHeight: 1.3,
                            }}>{subtitle}</div>
                        </div>
                </div>
            </div>
            </div>
        ),
        {
            width: 1200,
            height: 675 
        }
    )
}